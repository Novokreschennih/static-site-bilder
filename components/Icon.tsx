
import React from 'react';
import { MagicIcon } from './icons';

interface IconProps {
    name: string;
    className?: string;
}

const Icon: React.FC<IconProps> = ({ name, className }) => {
    if (name === 'logo') {
        return <MagicIcon className={className} />;
    }
    return null;
};

export default Icon;
