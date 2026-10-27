import ollama from 'ollama'

function chunkText(text, overlap = 150, size = 500){
   let start = 0; 
    let chunks = [];

    while(start <= text.length){
        let end = start + size;
        let chunk = text.slice(start, end);
        chunks.push(chunk);
        start += size - overlap;
    }

    return chunks.map(chunk => chunk.trim()).filter(Boolean);
}

async function embed(text){
   const result = await ollama.embed({
       model: "qwen3-embedding:0.6b",
       input: text
   });

    return result;
}

function cosineSimilarity(v1, v2){
    let dot = 0;
    let A = 0, B = 0;

    for(let i = 0; i < v1.length; i++){
        dot += v1[i] * v2[i];
        A += v1[i] * v1[i];
        B += v2[i] * v2[i];
    }

    return dot / (Math.sqrt(A) * Math.sqrt(B));
}

async function search(query, DB){
    const queryEmbedding = await embed(query);

    const results = DB.map(item => ({
        ...item,
        score: cosineSimilarity(item, queryEmbedding)
    })).sort((a, b) => b.score - a.score);

    return results;
}

async function chat(question, context){
    const query = `
        Anser only based on the given context
        If you don't know, say so.

        Context:
        ${context}

        Query:
        ${question}

    `;

    const response = await ollama.chat({
        model: "llama3",
        messages: [
            {role: 'user', content: query}
        ],
        options: {temperature: 0.2, num_ctx: 4000},
        stream: true
    });

    let isThinking = false;
    let answer = ""

    for await (const chunk of response){
        if(chunk.message.thinking){
            process.stdout.write("Thinking...\n");
        }
        else if(chunk.message.content){
           process.stdout.write(chunk.message.content ?? "None")
           answer += chunk.message.content;
        }
    }
            
    return answer;
}

(async function(){
    const data_drops = [
        "AI recognizes keyboard keys through sound",
        "The important file is located somewhere in the F or G drive"
    ];
   
    const records = [];

    for(const drop of data_drops){
        const chunks = chunkText(drop);

        for(const [i, chunk] in chunks.entries()){
            const embedding = await embed(chunk);
            
            records.push({
                id: `${i}`,
                chunk,
                embedding
            });
        }
    }
    
    const question = "How does AI recognize keyboard keys?"

    const answer = await chat(question, records);

    console.log(answer);
        
})
()
