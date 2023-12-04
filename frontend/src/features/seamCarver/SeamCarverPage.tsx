import React, { useState } from 'react';
import ServerDomain from './../../ServerDomain';
import { Alert, Button, Col, Container, Form, Image as Img, Row,Spinner } from 'react-bootstrap';
import { useForm, ValidateResult } from 'react-hook-form'

type FormValues = {
  file: FileList,
  height: string,
  width: string  
};

function SeamCarverPage() {
    const { register, handleSubmit, formState: { errors }, getValues } = useForm();

    const [selectedImage, setSelectedImage] = useState<HTMLImageElement>()
    const [carvedImage, setCarvedImage] = useState<string>()
    
    const [loading, setLoading] = useState<boolean>(false)
    const [serverError, setServerError] = useState<string>()
    
    async function onSubmit (data: FormValues)  {
        let imageFile = data.file[0]
        let image = await loadImagePromise(imageFile)
        
        setSelectedImage(image)
        setCarvedImage(undefined)
        setLoading(true)
        
        let form = new FormData();

        form.append('width', data.width)
        form.append('height', data.height)
        form.append('file', imageFile)
        
        let response = await fetch(`http://${ServerDomain}/seamCarver/upload`, {
            method: 'POST',
            body: form
        });

        if (response.ok) {
            await response.blob()
                .then(blob => {
                    setCarvedImage(URL.createObjectURL(blob));
                    setServerError('');
                });
        } else {
            await response.text()
                .then(text => {
                    setCarvedImage('');
                    setServerError(text);
                });
        }
        setLoading(false);
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
                action="http://zyoussef.com/seamCarver/upload" 
                method="post" 
                encType="multipart/form-data"
                onSubmit={handleSubmit(onSubmit)}
            >
                <Form.Group>
                    <Form.Label>Image File</Form.Label>
                    <Form.Control
                        type="file" 
                        accept=".png,.jpg"
                        disabled={loading}
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
                            disabled={loading}
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
                            disabled={loading}
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
            <Row>
                <Col>
                    {selectedImage &&
                        <Img src={selectedImage?.src} alt="Input file" fluid/>
                    }
                </Col>
                <Col>
                    {loading &&
                        <Row>
                            <Spinner animation="border"/>
                            <p>Carving image (this might take a while)</p>
                        </Row>
                    }
                    {carvedImage &&
                        <Img src={carvedImage} alt="Seam Carving Result" fluid/>}
                    {serverError &&
                        <Alert variant = "danger">
                            {serverError}
                        </Alert>
                    }
                </Col>
            </Row>
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

export default SeamCarverPage;