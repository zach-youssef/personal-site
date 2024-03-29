import ServerDomain from './ServerDomain';

export async function fetchGraphQL(text: string, variables: object){
    console.log(text);
    console.log(variables);
    
    const response = await fetch(`http://${ServerDomain}/graphql`, {
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