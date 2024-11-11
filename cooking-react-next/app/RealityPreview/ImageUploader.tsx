import { useState } from 'react';

interface ImageUploaderProps {
    realityImageBase64: string;
    setRealityImageBase64: (value: string) => void;
}

export default function ImageUploader(props: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingOut, setIsDraggingOut] = useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', 'image');
        e.dataTransfer.setData('image/base64', props.realityImageBase64);
        setIsDraggingOut(true);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setIsDraggingOut(false);
        
        // Get the component's bounding rectangle
        const rect = e.currentTarget.getBoundingClientRect();
        
        // Check if the drop position is outside the component's boundaries
        if (e.clientY < rect.top || e.clientY > rect.bottom ||
            e.clientX < rect.left || e.clientX > rect.right) {
            props.setRealityImageBase64('');
        } else {
            const imageData = e.dataTransfer.getData('image/base64');
            props.setRealityImageBase64(imageData);
        }
    };

    return (
        <div
            style={{
                width: '100%',
                height: '15vh',
                border: `2px dashed ${isDragging ? '#2196f3' : isDraggingOut ? '#ff4444' : '#ccc'}`,
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDragging ? 'rgba(33, 150, 243, 0.05)' : '#f5f5f5',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isDragging ? '0 4px 12px rgba(33, 150, 243, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.06)'
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            props.setRealityImageBase64(event.target.result as string);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }}
        >
            {props.realityImageBase64 ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <img 
                        src={props.realityImageBase64} 
                        alt="Uploaded image"
                        draggable="true"
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            position: 'absolute',
                            animation: 'fadeIn 0.3s ease',
                            cursor: 'move',
                            zIndex: 2
                        }}
                    />
                    <div 
                        className="image-overlay" 
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            zIndex: 1,
                            pointerEvents: 'none'
                        }}>
                        <span style={{
                            color: 'white',
                            fontSize: '1.1rem',
                            textAlign: 'center',
                            padding: '8px 16px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '4px'
                        }}>
                            {isDraggingOut ? 'Release to delete' : 'Drop new image to replace or drag out to delete'}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    <span style={{ 
                        color: isDragging ? '#2196f3' : '#666', 
                        fontSize: '1.1rem', 
                        marginBottom: '0.5rem',
                        transition: 'color 0.3s ease'
                    }}>
                        {isDragging ? 'Drop image here' : 'Drag and drop an image here'}
                    </span>
                    <span style={{ 
                        color: '#999', 
                        fontSize: '0.9rem' 
                    }}>
                        Supported formats: PNG, JPG, JPEG
                    </span>
                </>
            )}
        </div>
    );
}