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
    [SiteText.AboutDesc] : "Lorem Ipsum",
    [SiteText.FeaturedProjectHeader] : "Featured Project",
    [SiteText.ProjectHeader] : "Projects"

};

export { SiteText, SiteTextContents }