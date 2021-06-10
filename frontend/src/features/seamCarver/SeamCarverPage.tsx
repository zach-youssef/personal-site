import React, { BaseSyntheticEvent, ChangeEvent, FormEvent, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import { SubmitHandler, useForm, ValidateResult } from 'react-hook-form'

type FormValues = {
  file: FileList,
  height: string,
  width: string  
};

function SeamCarverPage() {
    const { register, handleSubmit, setError, formState: { errors }, getValues } = useForm();

    const [selectedImage, setSelectedImage] = useState<HTMLImageElement>()
    
    async function onSubmit (data: FormValues)  {
        let imageFile = data.file[0]
        let image = await loadImagePromise(imageFile)
        let imageContents = await loadFileContentsPromise(imageFile)
        
        setSelectedImage(image)
        
        let width = parseInt(data.width)
        let height = parseInt(data.height)
    }
    
    async function withinImageWidth(width: string): Promise<ValidateResult> {
        let imageFile = getValues("file")[0];
        if (imageFile) {
            let image = await loadImagePromise(imageFile);
            return parseInt(width) <= image.width ? true : `Target height must <= the input image's width, ${image.width}`
        }
        return 'Image is not selected - unable to validate target width'
    }

    async function withinImageHeight(height: string): Promise<ValidateResult> {
        let imageFile = getValues("file")[0];
        if (imageFile) {
            let image = await loadImagePromise(imageFile);
            return parseInt(height) <= image.height ? true: `Target height must be <= the input image's height, ${image.height}`
        }
        return 'Image is not selected - unable to validate target height'
    }
    
    return (
        <Container>
            <Form 
                action="http://localhost:8080/seamCarver/upload" 
                method="post" 
                encType="multipart/form-data"
                onSubmit={handleSubmit(onSubmit)}
            >
                <Form.Group>
                    <Form.Label>Image File</Form.Label>
                    <Form.Control
                        type="file" 
                        accept=".png,.jpg"
                        {...register("file", {
                            required: {
                                value: true, 
                                message: "An image file is required"
                            }
                        })}
                    />
                    {errors.file && 
                        <Alert variant = "danger">
                            {errors.file.message}
                        </Alert>
                    }
                </Form.Group>
                <Form.Row>
                    <Form.Group>
                        <Form.Label>Target Width</Form.Label>
                        <Form.Control
                            type="number" 
                            {...register("width", {
                                validate: {
                                    positive: v => parseInt(v) > 0 ? true : "Target width must be positive",
                                    checkImage: v => withinImageWidth(v),
                                },
                                required: {
                                    value: true, 
                                    message: "A target width is required"
                                }
                            })}
                        />
                        {errors.width && 
                            <Alert variant = "danger">
                                {errors.width.message}
                            </Alert>
                        }
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Target Height</Form.Label>
                        <Form.Control
                            type="number" 
                            {...register("height", {
                                validate: {
                                    positive: v => parseInt(v) > 0 ? true : "Target height must be positive",
                                    checkImage: v => withinImageHeight(v),
                                },
                                required: {
                                    value: true, 
                                    message: "A target height is required"
                                }
                            })}
                        />
                        {errors.height && 
                            <Alert variant = "danger">
                                {errors.height.message}
                            </Alert>
                        }
                    </Form.Group>
                </Form.Row>
                <Button type="submit">Carve</Button>
            </Form>
            <img src={selectedImage?.src} />
        </Container>
    );
}

function loadImagePromise(file: File) { 
    return new Promise<HTMLImageElement>(resolve => {
        let img = new Image()
        img.onload = () => {
            resolve(img)
        }
        img.src = URL.createObjectURL(file)
    })
}

function loadFileContentsPromise(file: File) {
    return new Promise<ArrayBuffer | string | null>(resolve => {
        let reader = new FileReader()
        reader.readAsText(file)
        reader.onload = (evt) => {
            if (evt !== null && evt.target !== null) {
                resolve(evt!.target!.result)
            } else {
                resolve(null)
            }
        }
    })
}

export default SeamCarverPage;