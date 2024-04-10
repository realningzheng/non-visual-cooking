import React from 'react';
import {useState, useEffect} from 'react';
import { Grid } from '@mui/material';
import VideoPreview from '../VideoPreview';
import RealityPreview from '../RealityPreview';

export default function MainLayout() {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <Grid container spacing={3}>
            <Grid item xs={6}>
                <h2>Video preview</h2>
                <VideoPreview
                    vurl='https://www.youtube.com/watch?v=umiOuVA7PEc'
                    isPlaying={isPlaying}
                />
            </Grid>
            <Grid item xs={6} style={{ height: '90vh', overflow: 'scroll' }}>
                <h2>Reality preview</h2>
                <RealityPreview
                setIsPlaying={setIsPlaying}
                />
            </Grid>
        </Grid>
    )
}