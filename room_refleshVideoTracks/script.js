const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const textMyPId = document.getElementById('js-myPId');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  peer.once('open', () => textMyPId.textContent = peer.id);

  // Register join handler
  joinTrigger.addEventListener('click', async () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
    });
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {

      localStream.getVideoTracks().forEach( track => {
        track.enable = false;
        track.enable = true;
        console.log('reflesh video stream track');
      });

      const container = document.createElement('div');
      // mark peerId to find it later at peerLeave event
      container.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(container);

      // create a <Video> Object to play remote Video
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      container.append(newVideo);
      await newVideo.play().catch(console.error);

      // create a <label> Object to appear the peerId
      const text_pId = document.createElement('label');
      text_pId.textContent = stream.peerId;
      container.append(text_pId);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteObjects = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );

      Array.from(remoteObjects.children).forEach( item => {
        if(item.nodeName == 'VIDEO'){
          item.srcObject.getTracks().forEach(track => track.stop());
          item.srcObject = null;
        }
        item.remove();
      });

      remoteObjects.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '== You left ===\n';
      Array.from(remoteVideos.children).forEach(containers => {
        Array.from(containers.children).forEach( item => {
          if(item.nodeName == 'VIDEO'){
            item.srcObject.getTracks().forEach(track => track.stop());
            item.srcObject = null;
          }
          item.remove();
        });
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  });

  peer.on("error", (error) => {
    console.error;
    console.log(`${error.type}: ${error.message}`);
    if(error.type == 'room-error') console.log('A room-error has occored');
  });
})();
