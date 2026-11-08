import React, { useEffect, useRef, useState } from 'react';
import { pickRoomAtCanvas, renderMapToCanvas } from './renderMapToCanvas.js';

export function MapPreview({
  map = null,
  tileSize = 4,
  showRooms = true,
  showCorridors = true,
  showLabels = true,
  palette = undefined,
  className = '',
  style = {},
  onRoomClick = null,
  onTileClick = null,
}) {
  const canvasRef = useRef(null);
  const [hoveredRoom, setHoveredRoom] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !map) return;
    renderMapToCanvas(canvasRef.current, map, {
      tileSize,
      palette,
      showRooms,
      showCorridors,
      showLabels,
    });
  }, [map, tileSize, showRooms, showCorridors, showLabels, palette]);

  const handleClick = (e) => {
    if (!canvasRef.current || !map) return;

    if (onRoomClick) {
      const room = pickRoomAtCanvas(canvasRef.current, map, e.clientX, e.clientY, tileSize);
      if (room) onRoomClick(room);
    }

    if (onTileClick) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const x = Math.floor(((e.clientX - rect.left) * scaleX) / tileSize);
      const y = Math.floor(((e.clientY - rect.top) * scaleY) / tileSize);
      if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
        onTileClick({ x, y, value: (map.floorMask ?? map.mask)[y * map.width + x] });
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !map?.rooms?.length) return;
    const room = pickRoomAtCanvas(canvasRef.current, map, e.clientX, e.clientY, tileSize);
    setHoveredRoom(room);
  };

  return (
    <div
      className={`map-preview-container ${className}`}
      style={{ display: 'inline-block', position: 'relative', ...style }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredRoom(null)}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          cursor: hoveredRoom ? 'pointer' : 'default',
          maxWidth: '100%',
        }}
      />
      {hoveredRoom && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          Room {hoveredRoom.id} ({hoveredRoom.type}) | Path: {hoveredRoom.isOnCriticalPath ? `Critical #${hoveredRoom.criticalPathIndex}` : 'Side'}
        </div>
      )}
    </div>
  );
}

export default MapPreview;
