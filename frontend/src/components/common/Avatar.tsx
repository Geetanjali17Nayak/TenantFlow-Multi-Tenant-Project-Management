import React, { useState } from 'react';
import { User as UserIcon } from 'lucide-react';

interface AvatarProps {
  name?: string;
  avatarUrl?: string | null;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ name, avatarUrl, size = 34 }) => {
  // Remember which URL failed so a new URL gets a fresh attempt
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!avatarUrl && failedUrl !== avatarUrl;
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {showImage ? (
        <img src={avatarUrl} alt="" onError={() => setFailedUrl(avatarUrl)} />
      ) : initial ? (
        initial
      ) : (
        <UserIcon size={Math.round(size * 0.47)} />
      )}
    </span>
  );
};
