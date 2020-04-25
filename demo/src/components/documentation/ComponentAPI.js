import React from 'react';
import { css } from 'emotion';

import VideoSrc from './VideoSrc';
import PausedOverlay from './PausedOverlay';
// import LoadingOverlay from './LoadingOverlay';

export default function ComponentAPI() {
  return (
    <>
      <h2
        className={css`
          margin-top: 32px;
        `}
        id="component-api"
      >
        Component API
      </h2>
      <section
        className={css`
          margin-left: 10px;

          p,
          figure {
            margin-left: 8px;
          }

          h3 {
            margin: 32px 0 8px;

            :first-of-type {
              margin-top: 16px;
            }
          }
        `}
      >
        <VideoSrc />
        <PausedOverlay />
        {/* <LoadingOverlay /> */}
      </section>
    </>
  );
}
