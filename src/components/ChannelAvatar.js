import React, { useEffect, useState } from 'react';

/** Channel avatar with one cache-bust retry when a stale broken img was cached. */
export default function ChannelAvatar({ src, className }) {
  const [url, setUrl] = useState(src);

  useEffect(() => {
    setUrl(src);
  }, [src]);

  if (!url) {
    return null;
  }

  return (
    <img
      src={url}
      alt=""
      className={className}
      onError={() => {
        if (url.includes('retry=')) {
          return;
        }
        const sep = url.includes('?') ? '&' : '?';
        setUrl(`${url}${sep}retry=1`);
      }}
    />
  );
}
