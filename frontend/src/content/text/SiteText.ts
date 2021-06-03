enum SiteText {
    HeaderBar,
    AboutMeHeader,
    AboutDesc,
    FeaturedProjectHeader,
    ProjectHeader
}

const SiteTextContents: { [key in SiteText]: string } = {
    [SiteText.HeaderBar] : "Zach's Personal Website",
    [SiteText.AboutMeHeader] : "About Me",
    [SiteText.AboutDesc] : 
        "I am 5th year Computer Science student at Northeastern University. "
        + "I have had the opportunity to co-op at multiple companies, "
        + "including TripAdvisor, Draftkings, and Facebook. "
        + "This site showcases some of the more interesting coursework I have completed. Future personal projects will also be highlighted on this page.",
    [SiteText.FeaturedProjectHeader] : "Featured Project",
    [SiteText.ProjectHeader] : "Projects"

};

export { SiteText, SiteTextContents }