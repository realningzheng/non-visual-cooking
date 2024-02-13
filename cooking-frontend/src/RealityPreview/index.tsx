import { Button, Stack } from "@mui/material";
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../reducers';
import { userStartVideoPlay } from '../reducers/actions';

export default function RealityPreview() {
    const dispatch = useDispatch();

    return (
        <Stack spacing={2} justifyContent={'center'}>
            <Button variant="contained" color="primary" onClick={()=>{dispatch(userStartVideoPlay(true))}}>
                Play
            </Button>
            <Button variant="contained" color="primary" onClick={()=>{dispatch(userStartVideoPlay(false))}}>
                Pause
            </Button>
            <p></p>
            <Button variant="contained" color="success">
                Reasoning
            </Button>
            <Button variant="outlined" color="success">
                Forward
            </Button>
            <Button variant="outlined" color="success">
                Backward
            </Button>
        </Stack>
    );
}