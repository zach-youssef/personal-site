enum SiteText {
    HeaderBar,
    AboutMeHeader,
    AboutDesc,
    FeaturedProjectHeader,
    ProjectHeader,
    WorkHeader,
}

const SiteTextContents: { [key in SiteText]: string } = {
    [SiteText.HeaderBar] : "Zach's Personal Website",
    [SiteText.AboutMeHeader] : "About Me",
    [SiteText.AboutDesc] : "Software Engineer, Northeastern University Alum. \n I created this site as an interactive portfolio through which to continue practicing skills I don't necessarily use in my day job.",
    [SiteText.FeaturedProjectHeader] : "Featured Project",
    [SiteText.ProjectHeader] : "University Projects",
    [SiteText.WorkHeader] : "Professional Work",
};

export { SiteText, SiteTextContents }