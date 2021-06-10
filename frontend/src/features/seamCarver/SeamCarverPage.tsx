import React, { BaseSyntheticEvent, ChangeEvent, FormEvent, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { SubmitHandler, useForm } from 'react-hook-form'

type FormValues = {
  file: FileList,
  height: string,
  width: string  
};

function SeamCarverPage() {
    const { register, handleSubmit } = useForm();
    
    let onSubmit: SubmitHandler<FormValues> = (data: FormValues, event? : BaseSyntheticEvent) => {
        console.log(data)
        console.log(event?.isDefaultPrevented())
    }
    
    return (
        <form 
            action="http://localhost:8080/seamCarver/upload" 
            method="post" 
            encType="multipart/form-data"
            onSubmit={handleSubmit(onSubmit)}
        >
            <input 
                type="file" 
                {...register("file", {required: true})}
            />
            <input 
                type="number" 
                {...register("width", {required: true})}
            />
            <input 
                type="number" 
                {...register("height", {required: true})}
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