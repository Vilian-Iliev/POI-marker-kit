import {configureStore} from "@reduxjs/toolkit";
import { markerStateSlice } from "./markerStateMachine.ts";

export const store = configureStore({
    reducer:{
        markerState: markerStateSlice.reducer
    }
});

