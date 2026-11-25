import React, { useEffect, useRef, useState } from 'react';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';
import { WriteupVideo as Video } from './ProjectWriteup';

// The player, from YouTube's privacy-enhanced domain (the only frame source the site's
// Content-Security-Policy allows besides its own), starting as it loads, since it loads on a click
export function embedUrl(youtubeId: string): string {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1`;
}

// A YouTube video that contacts YouTube only once it's clicked: until then it's a poster the page
// draws itself (the title and a play button), which the player replaces
function WriteupVideo({ video }: { video: Video }) {
    const [playing, setPlaying] = useState(false);
    const player = useRef<HTMLIFrameElement>(null);

    // The button that had focus is gone, so focus moves to the player in its place
    useEffect(() => {
        if (playing) {
            player.current?.focus();
        }
    }, [playing]);

    return (
        <div className="writeup-video ratio ratio-16x9 rounded mb-4">
            {playing
                ? <iframe
                    ref={player}
                    src={embedUrl(video.youtubeId)}
                    title={video.title}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                />
                : <button
                    type="button"
                    className="writeup-video-poster"
                    onClick={() => setPlaying(true)}
                    aria-label={`${SiteTextContents[SiteText.PlayVideo]}: ${video.title}`}
                >
                    <svg className="writeup-video-play" viewBox="0 0 68 48" aria-hidden="true" focusable="false">
                        <rect width="68" height="48" rx="12"/>
                        <path d="M27 14 L47 24 L27 34 Z"/>
                    </svg>
                    <span className="writeup-video-title">{video.title}</span>
                    <span className="writeup-video-note">{SiteTextContents[SiteText.VideoLoadsFromYouTube]}</span>
                </button>}
        </div>
    );
}

export default WriteupVideo;
