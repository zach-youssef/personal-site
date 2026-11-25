// A project's page, as graphql-server's projectWriteup query serves it (see "Site copy" in the
// README). The page's title, and its image unless it has a video, come from projectInfo, so they
// match the project's card.

// The projects with a write-up page: graphql-server has a write-up for each PROFESSIONAL project
// and those in ProjectWriteupLoader.WRITTEN_UP
export const WRITEUP_IDS = ['broadAR', 'metaAvatars'];

// A diagram: a root-relative SVG among the backend's assets, drawn inline
export interface WriteupFigure {
    src: string,
    alt: string,
    caption: string,
}

export interface WriteupSection {
    heading: string | null,
    paragraphs: string[],
    // After the paragraphs
    figures: WriteupFigure[],
}

// A YouTube video, by the id in its URL
export interface WriteupVideo {
    youtubeId: string,
    title: string,
}

// A link to the project itself, such as its repository (https://)
export interface WriteupLink {
    title: string,
    url: string,
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
    // Exactly one of these: the card's image's alt text, or a video shown in the image's place
    imageAlt: string | null,
    video: WriteupVideo | null,
    sections: WriteupSection[],
    // Either may be empty
    links: WriteupLink[],
    articles: Article[],
}

export interface ProjectWriteupResponse {
    projectInfo: { name: string, imagePath: string } | null,
    projectWriteup: ProjectWriteup | null,
}

export const PROJECT_WRITEUP_QUERY = `
query ProjectWriteupQuery($id: String!) {
  projectInfo(id: $id) { name, imagePath }
  projectWriteup(id: $id) { context, imageAlt, video { youtubeId, title },
                            sections { heading, paragraphs, figures { src, alt, caption } },
                            links { title, url }, articles { title, source, date, url, note } }
}
`;
