import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';

function SeamCarverPage() {
    return (
        <form action="http://localhost:8080/seamCarver/upload" method="post" encType="multipart/form-data">
            <input type="file" name="file" />
            <input type="number" name="width"/>
            <input type="number" name="height"/>
            <Button type="submit">Upload</Button>
        </form>
    );
}

export default SeamCarverPage;