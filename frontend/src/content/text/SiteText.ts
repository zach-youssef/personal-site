enum SiteText {
    HeaderBar,
    AboutMeHeader,
    AboutDesc
}

const SiteTextContents: { [key in SiteText]: string } = {
    [SiteText.HeaderBar] : "Zach's Personal Website",
    [SiteText.AboutMeHeader] : "About Me",
    [SiteText.AboutDesc] : "Lorem Ipsum"
};

export { SiteText, SiteTextContents }