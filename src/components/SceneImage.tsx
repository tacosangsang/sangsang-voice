// 씬 그림. 그림이 아직 없는 씬(imageUrl 빈 값)은 씬 번호만 적힌 어두운 칸을 보여 준다.

import { SceneItem } from '../types';

interface SceneImageProps {
  scene: SceneItem;
  className?: string;
}

export default function SceneImage({ scene, className = '' }: SceneImageProps) {
  if (scene.imageUrl) {
    return <img key={scene.imageUrl} src={scene.imageUrl} alt={scene.title} className={className} />;
  }
  return (
    <div className={`flex items-center justify-center bg-neutral-900 text-neutral-600 ${className}`}>
      <span className="text-xs font-mono">{scene.id}</span>
    </div>
  );
}
