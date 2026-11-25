import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Form, Image as Img, Row, Spinner } from 'react-bootstrap';
import { useForm, ValidateResult } from 'react-hook-form'

// The server carves with a graph of objects per pixel (about 3.4 KB each), so it takes at most this
// many pixels: 96,048 is about 310 x 310
export const MAX_IMAGE_PIXELS = 96048;
const MAX_IMAGE_SIDE = Math.round(Math.sqrt(MAX_IMAGE_PIXELS));
// Images larger than this are refused before they are decoded or uploaded
export const MAX_UPLOAD_BYTES = 1024 * 1024;

type FormValues = {
    file: FileList,
    height: string,
    width: string
};

// An image decoded in the browser, shown from an object URL that its owner revokes
type DecodedImage = {
    url: string,
    width: number,
    height: number,
};

const formatSize = (width: number, height: number) => `${width} × ${height} px`;

// Resolves with the image's size, or rejects (revoking the URL) if the browser can't decode it
function decodeImage(blob: Blob): Promise<DecodedImage> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => resolve({ url, width: img.width, height: img.height });
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Not an image'));
        };
        img.src = url;
    });
}

// What the visitor sees when the server refuses: its own message if it sent plain text, otherwise
// (an HTML error page from the proxy, JSON, or nothing) a generic one with the status
async function serverErrorMessage(response: Response): Promise<string> {
    const generic = `The server couldn't carve the image (error ${response.status}). Try again later.`;
    if (!response.headers.get('content-type')?.includes('text/plain')) {
        return generic;
    }
    const text = (await response.text()).trim();
    return text || generic;
}

function SeamCarverPage() {
    const { register, handleSubmit, formState: { errors }, setValue, trigger, clearErrors } = useForm<FormValues>();

    // The chosen file's decode, which every validator awaits rather than decoding the file again;
    // undefined while no file (or one over MAX_UPLOAD_BYTES) is chosen
    const decoding = useRef<Promise<DecodedImage | undefined>>();
    const [selectedImage, setSelectedImage] = useState<DecodedImage>();
    const [carvedImage, setCarvedImage] = useState<DecodedImage & { name: string }>();

    const [loading, setLoading] = useState<boolean>(false)
    const [serverError, setServerError] = useState<string>()

    // Object URLs to revoke as the component unmounts, and the request to abort
    const urls = useRef({ selected: undefined as string | undefined, carved: undefined as string | undefined });
    const request = useRef<AbortController>();
    useEffect(() => () => {
        request.current?.abort();
        // A decode still running revokes its URL when it finds itself replaced
        decoding.current = undefined;
        if (urls.current.selected) URL.revokeObjectURL(urls.current.selected);
        if (urls.current.carved) URL.revokeObjectURL(urls.current.carved);
        urls.current = { selected: undefined, carved: undefined };
    }, []);

    function showSelected(image: DecodedImage | undefined) {
        if (urls.current.selected) URL.revokeObjectURL(urls.current.selected);
        urls.current.selected = image?.url;
        setSelectedImage(image);
    }

    function showCarved(image: (DecodedImage & { name: string }) | undefined) {
        if (urls.current.carved) URL.revokeObjectURL(urls.current.carved);
        urls.current.carved = image?.url;
        setCarvedImage(image);
    }

    // Starts decoding the chosen file; returns true when it was refused without decoding, so its
    // error can be shown straight away
    function onFileChange(event: ChangeEvent<HTMLInputElement>): boolean {
        const file = event.target.files?.[0];
        showSelected(undefined);
        if (!file || file.size > MAX_UPLOAD_BYTES) {
            decoding.current = undefined;
            return !!file;
        }
        const thisDecode: Promise<DecodedImage | undefined> = decodeImage(file).then(
            image => {
                if (decoding.current !== thisDecode) {
                    // Another file was chosen meanwhile
                    URL.revokeObjectURL(image.url);
                    return undefined;
                }
                showSelected(image);
                // A new image needs new targets: start from its own size
                setValue('width', String(image.width));
                setValue('height', String(image.height));
                clearErrors(['width', 'height']);
                return image;
            },
            () => undefined);
        decoding.current = thisDecode;
        thisDecode.then(() => {
            if (decoding.current === thisDecode) trigger('file');
        });
        return false;
    }

    async function onSubmit(data: FormValues) {
        const imageFile = data.file[0];
        showCarved(undefined);
        setServerError(undefined);
        setLoading(true);

        const form = new FormData();
        form.append('width', data.width);
        form.append('height', data.height);
        form.append('file', imageFile);

        const controller = new AbortController();
        request.current = controller;
        try {
            let response: Response;
            try {
                response = await fetch('/seamCarver/upload', {
                    method: 'POST',
                    body: form,
                    signal: controller.signal,
                });
            } catch {
                if (!controller.signal.aborted) setServerError("Couldn't reach the server, try again.");
                return;
            }
            if (!response.ok) {
                const message = await serverErrorMessage(response);
                if (!controller.signal.aborted) setServerError(message);
                return;
            }
            const carved = await decodeImage(await response.blob());
            if (controller.signal.aborted) {
                URL.revokeObjectURL(carved.url);
                return;
            }
            const baseName = imageFile.name.replace(/\.[^.]*$/, '');
            showCarved({ ...carved, name: `${baseName}-${carved.width}x${carved.height}.png` });
        } catch {
            if (!controller.signal.aborted) setServerError("The server's result couldn't be read. Try again later.");
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }

    async function validateFile(files: FileList): Promise<ValidateResult> {
        const file = files[0];
        if (!file) return true;
        if (file.size > MAX_UPLOAD_BYTES) return 'Image file too large (max 1 MB)';
        const image = await decoding.current;
        if (!image) return "Couldn't read this file as an image. Choose a PNG or JPEG.";
        if (image.width * image.height > MAX_IMAGE_PIXELS) {
            return `This image is ${formatSize(image.width, image.height)}, too large to carve: `
                + `the most it takes is ${MAX_IMAGE_PIXELS.toLocaleString('en-US')} pixels, `
                + `about ${formatSize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE)}.`;
        }
        return true;
    }

    // A target can't exceed the image; without a readable image, the file's own error stops the submit
    async function withinImage(value: string, side: 'width' | 'height'): Promise<ValidateResult> {
        const image = await decoding.current;
        if (!image) return true;
        return parseInt(value) <= image[side] ? true : `Target ${side} must be <= the input image's ${side}, ${image[side]}`;
    }

    const fileRegistration = register('file', {
        validate: { image: validateFile },
        required: { value: true, message: 'An image file is required' },
    });

    const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

    return (
        <Container>
            <Form
                action="/seamCarver/upload"
                method="post"
                encType="multipart/form-data"
                noValidate
                onSubmit={handleSubmit(onSubmit)}
            >
                <Form.Group>
                    <Form.Label htmlFor="seamCarverFile">Image File</Form.Label>
                    <Form.Control
                        type="file"
                        id="seamCarverFile"
                        accept=".png,.jpg,.jpeg"
                        disabled={loading}
                        isInvalid={!!errors.file}
                        aria-invalid={!!errors.file}
                        aria-describedby={describedBy('seamCarverFileHelp', errors.file && 'seamCarverFileError')}
                        {...fileRegistration}
                        onChange={async event => {
                            // First, so RHF's revalidation awaits this file's decode, not the previous one's
                            const refused = onFileChange(event as ChangeEvent<HTMLInputElement>);
                            await fileRegistration.onChange(event);
                            if (refused) trigger('file');
                        }}
                    />
                    <Form.Text id="seamCarverFileHelp" muted>
                        {selectedImage && <>Chosen image: {formatSize(selectedImage.width, selectedImage.height)}. </>}
                        A PNG or JPEG up to 1 MB and {MAX_IMAGE_PIXELS.toLocaleString('en-US')} pixels
                        (about {formatSize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE)}).
                    </Form.Text>
                    {errors.file &&
                        <Form.Control.Feedback type="invalid" id="seamCarverFileError">
                            {errors.file.message}
                        </Form.Control.Feedback>
                    }
                </Form.Group>
                <Form.Row>
                    {(['width', 'height'] as const).map(side => {
                        const id = `seamCarverTarget-${side}`;
                        const label = side === 'width' ? 'Target Width' : 'Target Height';
                        return (
                            <Form.Group as={Col} xs={12} sm={6} key={side}>
                                <Form.Label htmlFor={id}>{label}</Form.Label>
                                <Form.Control
                                    type="number"
                                    id={id}
                                    min={1}
                                    disabled={loading}
                                    isInvalid={!!errors[side]}
                                    aria-invalid={!!errors[side]}
                                    aria-describedby={describedBy(errors[side] && `${id}-error`)}
                                    {...register(side, {
                                        validate: {
                                            positive: v => parseInt(v) > 0 ? true : `Target ${side} must be positive`,
                                            withinImage: v => withinImage(v, side),
                                        },
                                        required: { value: true, message: `A target ${side} is required` },
                                    })}
                                />
                                {errors[side] &&
                                    <Form.Control.Feedback type="invalid" id={`${id}-error`}>
                                        {errors[side]?.message}
                                    </Form.Control.Feedback>
                                }
                            </Form.Group>
                        );
                    })}
                </Form.Row>
                <Button type="submit" disabled={loading}>Carve</Button>
            </Form>
            <Row className="mt-3">
                <Col xs={12} md={6}>
                    {selectedImage &&
                        <Img
                            src={selectedImage.url}
                            alt={`Input image, ${formatSize(selectedImage.width, selectedImage.height)}`}
                            fluid
                        />
                    }
                </Col>
                <Col xs={12} md={6}>
                    {/* Always mounted, so screen readers announce what appears in it */}
                    <div role="status" className="d-flex align-items-center">
                        {loading &&
                            <>
                                <Spinner animation="border" aria-hidden="true" className="mr-2"/>
                                <span>Carving image (this might take a while)</span>
                            </>
                        }
                    </div>
                    {carvedImage &&
                        <>
                            <Img
                                src={carvedImage.url}
                                alt={`Carved image, ${formatSize(carvedImage.width, carvedImage.height)}`}
                                fluid
                            />
                            <p><a href={carvedImage.url} download={carvedImage.name}>Download PNG</a></p>
                        </>
                    }
                    {serverError &&
                        <Alert variant="danger">
                            {serverError}
                        </Alert>
                    }
                </Col>
            </Row>
        </Container>
    );
}

export default SeamCarverPage;
