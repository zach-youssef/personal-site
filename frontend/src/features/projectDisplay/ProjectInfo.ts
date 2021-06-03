class ProjectInfo {
    title: string;
    descriptionText: string;
    previewImageFilePath: string;

    
    constructor(title: string, descriptionText: string, previewImageFilePath: string){
        this.title = title;
        this.descriptionText = descriptionText;
        this.previewImageFilePath = previewImageFilePath;
    }
    
    getTitle(): string {
        return this.title;
    }
    
    getDescriptionText(): string {
        return this.descriptionText;
    }
    
    getImageFilePath(): string {
        return this.previewImageFilePath;
    }
}

export default ProjectInfo;