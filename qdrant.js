import { QdrantClient } from "@qdrant/js-client-rest";

import fs from "node:fs/promises"
import { loadEnvFile, env } from "node:process"

loadEnvFile();

const client = new QdrantClient({
    url: env.CLUSTER_URL, 
    apiKey: env.QDRANT_API_KEY
});

const modelName = "sentence-transformers/all-MiniLM-L6-v2"

async function createCollection(name="items"){
    await client.createCollection(name, {
      vectors: { size: 384, distance: "Cosine" },
    });
}

async function createIdx(collName, field, type){
    await client.createPayloadIndex(collName, {
        field_name: field,
        field_schema: type
    }, {wait: true});
}

async function getDocs(){
    const raw = await fs.readFile("docs.json", "utf8");

    const data = JSON.parse(raw);

   return data; 
}

async function embed(collName){
    const docs = await getDocs();

    const points = [];
    let id = 0;

    for (const doc of docs){
        points.push({
            id,
            vector: {
                text: `${Object.values(doc).join("|")}`,
                model: modelName
            },
            payload: {
                item_id: doc.id,
                title: doc.title,
                category: doc.category,
                content: doc.content
            }
        });
        
        id++;
    }

    await client.upsert(collName, { points } );
}

async function search(options){
    const {query, collName, limit = 5, category} = options;

    const filter = category ?
        {must: [ { key: "category", match: { text: category } } ] } : {}

    const queryResults = await client.query(collName, {
        query: {
            text: query,
            model: modelName
        },
        filter,
        with_payload: true,
        limit
    });

    console.table(queryResults.points);
    queryResults.points.forEach(res => console.log(res.payload))
}


(async function(){
    
    // Commented lines because the collection has already been created and filled
    //await createCollection("files")
    //await embed("files");
    await createIdx("files", "category", "text");

    await search({
        query: "What should be done when a CI pipeline fail?",
        collName: "files",
        category: "devops",
        limit: 3 
    });
})();
