import React from 'react';
import { css, cx } from 'emotion';
import { formatVideoSrc, formatVideoCaptions } from './utils';

// Noop function does nothing - used as default for optional callbacks
const noop = () => {};

// Enumerates states that the hover player can be in
const HOVER_PLAYER_STATE = {
  stopped: 0,
  attemptingToStop: 1,
  attemptingToStart: 2,
  playing: 3,
};

// Set up our emotion CSS classes
const basePlayerContainerStyle = css`
  position: relative;
`;

const expandToCoverPlayerStyle = css`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
`;

const basePausedOverlayStyle = css`
  position: relative;
  display: block;
  width: 100%;
  z-index: 1;
  pointer-events: none;

  /* By default the paused overlay should be set to fill its available width */
  > * {
    display: block;
    width: 100%;
  }
`;

const baseLoadingOverlayStyle = css`
  z-index: 2;
  pointer-events: none;
`;

const baseVideoStyle = css`
  width: 100%;
  display: block;
  object-fit: cover;
`;

/**
 * @typedef   {object}  VideoSource
 * @property  {string}  src - The src URL string to use for a video player source
 * @property  {string}  type - The media type of the video, ie 'video/mp4'
 */

/**
 * @typedef   {object}  VideoCaptionsTrack
 * @property  {string}  src - The src URL string for the captions track file
 * @property  {string}  srcLang - The language code for the language that these captions are in
 * @property  {string}  label - The title of the captions track
 */

/**
 * @component HoverVideoPlayer
 *
 * @param {!(string|string[]|VideoSource|VideoSource[])}  videoSrc - Source(s) to use for the video player. Accepts 3 different formats:
 *                                                                   - **String**: the URL string to use as the video player's src
 *                                                                   - **Object**: an object with attributes:
 *                                                                     - src: The src URL string to use for a video player source
 *                                                                     - type: The media type of the video source, ie 'video/mp4'
 *                                                                   - **Array**: if you would like to provide multiple sources, you can provide an array of URL strings and/or objects with the shape described above
 * @param {!(string|string[]|VideoCaptionsTrack|VideoCaptionsTrack[])} videoCaptions - Captions track(s) to use for the video player for accessibility. Accepts 3 different formats:
 *                                                                                     - **String**: the URL string to use as the captions track's src
 *                                                                                     - **Object**: an object with attributes:
 *                                                                                       - src: The src URL string for the captions track file
 *                                                                                       - srcLang: The language code for the language that these captions are in (ie, 'en', 'es', 'fr')
 *                                                                                       - label: The title of the captions track
 *                                                                                     - **Array**: if you would like to provide multiple caption tracks, you can provide an array of objects with the shape described above
 * @param {bool}    [isFocused=false] - Offers a prop interface for forcing the video to start/stop without DOM events
 *                                        When set to true, the video will begin playing and any events that would normally
 *                                        stop it will be ignored
 * @param {node}    [pausedOverlay] - Contents to render over the video while it's not playing
 * @param {node}    [loadingOverlay] - Contents to render over the video while it's loading
 * @param {number}  [overlayFadeTransitionDuration=400] - The transition duration in ms for how long it should take for the overlay to fade in/out
 * @param {bool}    [shouldRestartOnVideoStopped=true] - Whether the video should reset to the beginning every time it stops playing after the user mouses out of the player
 * @param {bool}    [shouldUseOverlayDimensions=true] - Whether the player should display using the pausedOverlay's dimensions rather than the video element's dimensions if an overlay is provided
 *                                                        This helps prevent content height jumps when the video loads its dimensions
 * @param {func}    [onStartingVideo] - Optional callback for every time the user mouses over or focuses on the hover player and we attempt to start the video
 * @param {func}    [onStartedVideo] - Optional callback for when the video has been successfully started
 * @param {func}    [onStoppingVideo] - Optional callback for every time the user mouses out or blurs the hover player and we attempt to stop the video
 * @param {func}    [onStoppedVideo] - Optional callback for when the video has successfully been stopped
 * @param {func}    [onVideoPlaybackFailed] - Optional callback for when the video throws an error while attempting to play
 * @param {bool}    [isVideoMuted=true] - Whether the video player should be muted
 * @param {bool}    [shouldShowVideoControls=false] - Whether the video player should show the browser's controls
 * @param {bool}    [shouldVideoLoop=true] - Whether the video player should loop when it reaches the end
 * @param {string}  [className] - Optional className to apply custom styling to the container element
 * @param {string}  [pausedOverlayWrapperClassName] - Optional className to apply custom styling to the overlay contents' wrapper
 * @param {string}  [loadingOverlayWrapperClassName] - Optional className to apply custom styling to the loading state overlay contents' wrapper
 * @param {string}  [videoClassName] - Optional className to apply custom styling to the video element
 * @param {object}  [style] - Style object to apply custom CSS styles to the hover player container
 *
 * @license MIT
 */
function HoverVideoPlayer({
  videoSrc,
  videoCaptions,
  isFocused = false,
  pausedOverlay = null,
  loadingOverlay = null,
  overlayFadeTransitionDuration = 400,
  shouldRestartOnVideoStopped = true,
  shouldUseOverlayDimensions = true,
  onStartingVideo = noop,
  onStartedVideo = noop,
  onStoppingVideo = noop,
  onStoppedVideo = noop,
  onVideoPlaybackFailed = noop,
  isVideoMuted = true,
  shouldShowVideoControls = false,
  shouldVideoLoop = true,
  className = '',
  pausedOverlayWrapperClassName = '',
  loadingOverlayWrapperClassName = '',
  videoClassName = '',
  style = null,
}) {
  const [hoverPlayerState, setHoverPlayerState] = React.useState(
    HOVER_PLAYER_STATE.stopped
  );

  const containerRef = React.useRef();
  const videoRef = React.useRef();
  const pauseVideoTimeoutRef = React.useRef();
  const isVideoLoadingRef = React.useRef(false);

  // Parse the `videoSrc` prop into an array of VideoSource objects to be used for the video player
  const parsedVideoSources = React.useMemo(() => formatVideoSrc(videoSrc), [
    videoSrc,
  ]);

  const parsedVideoCaptions = React.useMemo(
    () => formatVideoCaptions(videoCaptions),
    [videoCaptions]
  );

  /**
   * @function  attemptStartVideo
   *
   * Starts the video and fades the paused overlay out when the user mouses over or focuses in the video container element
   */
  function attemptStartVideo() {
    // If the user quickly moved their mouse away and then back over the container,
    // cancel any outstanding timeout that would pause the video
    clearTimeout(pauseVideoTimeoutRef.current);

    // Return early if already playing or attempting to play
    if (hoverPlayerState >= HOVER_PLAYER_STATE.attemptingToStart) return;

    if (videoRef.current.paused) {
      // Fire onStartingVideo callback to indicate the video is attempting to start
      onStartingVideo();
      // Update the player state to reflect that we are now attempting to play
      setHoverPlayerState(HOVER_PLAYER_STATE.attemptingToStart);
      isVideoLoadingRef.current = true;

      // Play the video
      videoRef.current.play();
    } else if (isVideoLoadingRef.current) {
      // If the video is still loading, indicate that the video is attempting to start
      onStartingVideo();
      setHoverPlayerState(HOVER_PLAYER_STATE.attemptingToStart);
    } else {
      // If the video was already loaded and playing, just update the state to reflect that
      setHoverPlayerState(HOVER_PLAYER_STATE.playing);
    }
  }

  /**
   * @function  attemptStopVideo
   *
   * Stops the video and fades the paused overlay in when the user mouses out from or blurs the video container element
   */
  const attemptStopVideo = React.useCallback(() => {
    // If the isFocused override prop is active, ignore any other events attempting to stop the video
    // Also return early if the video is already stopped
    if (isFocused || hoverPlayerState <= HOVER_PLAYER_STATE.attemptingToStop)
      return;

    // Mark that we're attempting to stop the video
    setHoverPlayerState(HOVER_PLAYER_STATE.attemptingToStop);

    // Fire onStoppingVideo callback
    onStoppingVideo();

    // If we already had a timeout going to pause the video, cancel it so we can
    // replace it with a new one
    clearTimeout(pauseVideoTimeoutRef.current);

    // Set a timeout with the duration of the overlay's fade transition so the video
    // won't stop until it's fully hidden
    pauseVideoTimeoutRef.current = setTimeout(
      () => {
        // Mark that the video is now stopped
        setHoverPlayerState(HOVER_PLAYER_STATE.stopped);

        // Fire onStoppedVideo callback to indicate the video has been stopped
        onStoppedVideo();

        // Pause the video if it's not still in the middle of attempting to play so we don't interrupt it -
        // since we're in the stopped state now, the video will pause itself as soon as it finishes loading
        if (!isVideoLoadingRef.current) {
          videoRef.current.pause();
        }

        if (shouldRestartOnVideoStopped) {
          // If we should restart the video, reset its time to the beginning
          videoRef.current.currentTime = 0;
        }
      },
      // If we don't have to wait for the overlay to fade back in, just set the timeout to 0 to invoke it ASAP
      pausedOverlay ? overlayFadeTransitionDuration : 0
    );
  }, [
    hoverPlayerState,
    isFocused,
    onStoppedVideo,
    onStoppingVideo,
    overlayFadeTransitionDuration,
    pausedOverlay,
    shouldRestartOnVideoStopped,
  ]);

  React.useEffect(() => {
    // Manually setting the `muted` attribute on the video element via an effect in order
    // to avoid a know React issue with the `muted` prop not applying correctly on initial render
    // https://github.com/facebook/react/issues/10389
    videoRef.current.muted = isVideoMuted;
  }, [isVideoMuted]);

  React.useEffect(() => {
    // Use effect to start/stop the video when isFocused override prop changes
    if (isFocused) {
      attemptStartVideo();
    } else {
      attemptStopVideo();
    }

    // We really only want to fire this effect when the isFocused prop changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  React.useEffect(() => {
    // Ensure casting controls aren't shown on the video
    videoRef.current.disableRemotePlayback = true;
  }, []);

  React.useEffect(() => {
    const onWindowTouchStart = (event) => {
      if (!containerRef.current.contains(event.target)) {
        attemptStopVideo();
      }
    };

    window.addEventListener('touchstart', onWindowTouchStart);

    // Remove the event listener on cleanup
    return () => window.removeEventListener('touchstart', onWindowTouchStart);
  }, [attemptStopVideo]);

  // The video should use the overlay's dimensions rather than the other way around if
  //  an overlay was provided and the shouldUseOverlayDimensions is true
  const shouldVideoExpandToFitOverlayDimensions =
    pausedOverlay && shouldUseOverlayDimensions;

  return (
    <div
      onMouseEnter={attemptStartVideo}
      onFocus={attemptStartVideo}
      onMouseOut={attemptStopVideo}
      onBlur={attemptStopVideo}
      onTouchStart={attemptStartVideo}
      className={cx(basePlayerContainerStyle, className)}
      style={style}
      data-testid="hover-video-player-container"
      ref={containerRef}
    >
      {pausedOverlay && (
        <div
          style={{
            opacity:
              hoverPlayerState <= HOVER_PLAYER_STATE.attemptingToStart ? 1 : 0,
            transition: `opacity ${overlayFadeTransitionDuration}ms`,
          }}
          className={cx(
            basePausedOverlayStyle,
            {
              [expandToCoverPlayerStyle]: !shouldVideoExpandToFitOverlayDimensions,
            },
            pausedOverlayWrapperClassName
          )}
          data-testid="paused-overlay-wrapper"
        >
          {pausedOverlay}
        </div>
      )}
      {loadingOverlay && (
        <div
          style={{
            opacity:
              hoverPlayerState === HOVER_PLAYER_STATE.attemptingToStart ? 1 : 0,
            transition: `opacity ${overlayFadeTransitionDuration}ms`,
          }}
          className={cx(
            baseLoadingOverlayStyle,
            expandToCoverPlayerStyle,
            loadingOverlayWrapperClassName
          )}
          data-testid="loading-overlay-wrapper"
        >
          {loadingOverlay}
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        controls={shouldShowVideoControls}
        loop={shouldVideoLoop}
        playsInline
        // Only preload video data if we depend on having loaded its dimensions to display it
        preload={shouldVideoExpandToFitOverlayDimensions ? 'none' : 'metadata'}
        ref={videoRef}
        className={cx(
          baseVideoStyle,
          {
            [expandToCoverPlayerStyle]: shouldVideoExpandToFitOverlayDimensions,
          },
          videoClassName
        )}
        onPlaying={() => {
          isVideoLoadingRef.current = false;

          if (hoverPlayerState >= HOVER_PLAYER_STATE.attemptingToStart) {
            // If the player was showing a loading state, transition into the playing state
            setHoverPlayerState(HOVER_PLAYER_STATE.playing);

            // Fire onStartedVideo callback to indicate the video has successfully started
            onStartedVideo();
          } else if (hoverPlayerState === HOVER_PLAYER_STATE.stopped) {
            // If our play attempt completed but the user has since moused away and is not looking
            // at the loading state, immediately pause the video until the user comes back
            videoRef.current.pause();
          }
        }}
        onError={() => {
          setHoverPlayerState(HOVER_PLAYER_STATE.stopped);

          // If we have an onVideoPlaybackFailed callback, fire it to indicate the play attempt failed
          onVideoPlaybackFailed();
        }}
      >
        {parsedVideoSources.map(({ src, type }) => (
          <source key={src} src={src} type={type} />
        ))}
        {parsedVideoCaptions.map(({ src, srcLang, label }) => (
          <track
            key={src}
            kind="captions"
            src={src}
            srcLang={srcLang}
            label={label}
          />
        ))}
      </video>
    </div>
  );
}

export default HoverVideoPlayer;
