import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

export const useDimensions = () => {
    const [dims, setDims] = useState(Dimensions.get('window'));

    useEffect(() => {
        const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
        return () => sub.remove();
    }, []);

    return { ...dims, isLandscape: dims.width > dims.height };
};