// A professional project's page, as graphql-server's projectWriteup query serves it (see "Site copy"
// in the README). The page's title and image come from projectInfo, so they match the project's card.

// The projects with a write-up page; graphql-server has a write-up for each PROFESSIONAL project
export const WRITEUP_IDS = ['broadAR', 'metaAvatars'];

export interface WriteupSection {
    heading: string | null,
    paragraphs: string[],
}

export interface Article {
    title: string,
    source: string,
    // "YYYY-MM" or "YYYY-MM-DD"
    date: string | null,
    url: string,
    // One line on what the article covers
    note: string,
}

export interface ProjectWriteup {
    context: string,
    imageAlt: string,
    sections: WriteupSection[],
    articles: Article[],
}

export interface ProjectWriteupResponse {
    projectInfo: { name: string, imagePath: string } | null,
    projectWriteup: ProjectWriteup | null,
}

export const PROJECT_WRITEUP_QUERY = `
query ProjectWriteupQuery($id: String!) {
  projectInfo(id: $id) { name, imagePath }
  projectWriteup(id: $id) { context, imageAlt, sections { heading, paragraphs },
                            articles { title, source, date, url, note } }
}
`;
