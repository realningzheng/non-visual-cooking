import { Grid } from '@mui/material';
import VideoPreview from '../VideoPreview';
import RealityPreview from '../RealityPreview';

export default function MainLayout() {
    return (
        <div>
            <h1>Non visual cooking</h1>
            <Grid container spacing={3}>
                <Grid item xs={6}>
                    <h2>Video preview</h2>
                    <VideoPreview vurl='https://www.youtube.com/watch?v=umiOuVA7PEc' />
                </Grid>
                <Grid item xs={6} style={{height:'90vh', overflow:'scroll'}}>
                    <h2>Reality preview</h2>
                    <RealityPreview />
                </Grid>
            </Grid>
        </div>
    )
}