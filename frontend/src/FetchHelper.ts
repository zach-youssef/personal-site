export async function fetchGraphQL(text: string, variables: object){
    console.log(text);
    
    const response = await fetch('http://localhost:8080/graphql', {
        method: 'POST',
        headers: {
            'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
            query: text,
            variables,
        }),
    });

    return await response.json();
}