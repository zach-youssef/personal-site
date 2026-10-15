// The backend serves the site too, so a relative path reaches it over whichever protocol the
// page was loaded with; the Vite dev and preview servers forward it to a local backend
export async function fetchGraphQL(text: string, variables: object){
    const response = await fetch('/graphql', {
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