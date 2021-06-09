import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useFilePicker } from 'use-file-picker';

function SeamCarverPage() {
    const [openFileSelector, {filesContent, errors, loading, plainFiles}] = useFilePicker({
        multiple: false,
        accept: ['.png'] // TODO extend
    });
    const [serverResponse, setResponse] = useState("")
    
    if (errors.length > 0) 
        return <p>ERROR LOL</p>
    
    if (loading) {
        return <Spinner animation="border"/>
    }
    
    return (
        <form action="http://localhost:8080/seamCarver/upload">
            <input type="file" name="test" />
            <Button type="submit">Upload</Button>
        </form>
    );
}

export default SeamCarverPage;