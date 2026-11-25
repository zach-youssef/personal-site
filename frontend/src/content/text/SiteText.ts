enum SiteText {
    HeaderBar,
    AboutMeHeader,
    AboutDesc,
    FeaturedProjectHeader,
    SeeMoreProjects,
    BackToProjects,
    ProjectHeader,
    WorkHeader,
    Personal,
    ArticlesHeader,
    WriteupLoadFailed,
}

const SiteTextContents: { [key in SiteText]: string } = {
    [SiteText.HeaderBar] : "Zoey's Personal Website",
    [SiteText.AboutMeHeader] : "About Me",
    [SiteText.AboutDesc] : "Software Engineer, Northeastern University Alum. \n I created this site as an interactive portfolio through which to continue practicing skills I don't necessarily use in my day job.",
    [SiteText.FeaturedProjectHeader] : "Featured Projects",
    [SiteText.SeeMoreProjects] : "See more",
    [SiteText.BackToProjects] : "Back to Projects",
    [SiteText.ProjectHeader] : "University Projects",
    [SiteText.WorkHeader] : "Professional Work",
    [SiteText.Personal] : "Side Projects",
    [SiteText.ArticlesHeader] : "Articles",
    [SiteText.WriteupLoadFailed] : "This project's page couldn't be loaded. Please try again later.",
};

export { SiteText, SiteTextContents }