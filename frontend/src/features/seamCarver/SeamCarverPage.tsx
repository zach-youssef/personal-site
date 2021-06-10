import React, { ChangeEvent, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';

function SeamCarverPage() {
    let [targetWidth, setTargetWidth] = useState<number>()
    let [targetHeight, setTargetHeight] = useState<number>()

    let [file, setFile] = useState<File>()
    let [width, setWidth] = useState<number>(-1)
    let [height, setHeight] = useState<number>(-1)
    
    let [loading, setLoading] = useState<Boolean>(false)
    
    function handleSetWidth(event: ChangeEvent<HTMLInputElement>) {
        let w = parseInt(event.target.value)
        if (w <= width || w >= 0) {
            setTargetWidth(w)
        }
    }

    function handleSetHeight(event: ChangeEvent<HTMLInputElement>) {
        let h = parseInt(event.target.value)
        if (h <= width || h >= 0) {
            setTargetHeight(h)
        }
    }
    
    function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
        let files = event.target.files
        if (files === null) {
            return
        }
        setFile(files[0])
        
        if (file === undefined){
            console.error("Image failed to load :(")
            return
        }
        
        // Store the image's width and height for input validation
        setLoading(true)
        getImageDimensions(file!!).then(dim => {
            setWidth(dim.width)
            setTargetWidth(dim.width)
            setHeight(dim.height)
            setTargetHeight(dim.height)
            setLoading(false)
        })

    }
    
    if (loading) {
        return <Spinner animation="border"/>
    }

    return (
        <form action="http://localhost:8080/seamCarver/upload" method="post" encType="multipart/form-data">
            <input 
                type="file" 
                name="file" 
                onChange={handleFileSelect}
            />
            <input 
                type="number" 
                name="width" 
                disabled={file == undefined}
                value={targetWidth}
                onChange={handleSetWidth}
            />
            <input 
                type="number" 
                name="height" 
                disabled={file == undefined}
                value={targetHeight}
                onChange={handleSetHeight}
            />
            <Button type="submit">Upload</Button>
        </form>
    );
}

function imageDimensionPromise(file: File) { 
    return new Promise<Dimensions>(resolve => {
        let img = new Image()
        img.onload = () => {
            const dimensions: Dimensions = {
                height: img.height,
                width: img.width
            }
            resolve(dimensions)
        }
        img.src = URL.createObjectURL(file)
    })
}

interface Dimensions {
    height: number,
    width: number
}

async function getImageDimensions(file: File): Promise<Dimensions>  {
    return await imageDimensionPromise(file)
}

export default SeamCarverPage;