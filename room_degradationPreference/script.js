const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const gsTrigger = document.getElementById('js-getStats-trigger');
  const dpTrigger_fr = document.getElementById('js-degPrefFR-trigger');
  const dpTrigger_rsl = document.getElementById('js-degPrefRsl-trigger');
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
      video: {
        width: 1024,
        height: 720,
      }
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

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const roomMode = getRoomModeByHash();
    const room = peer.joinRoom(roomId.value, {
      mode: roomMode,
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
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '== You left ===\n';
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    gsTrigger.addEventListener('click', async () => {
      if(roomMode == 'mesh'){
        const pcs = room.getPeerConnections();
        for([peerId, pc] of Object.entries(pcs)){
          const stats = await pc.getStats();
          printStats(stats, peerId);
        }
      } else if(roomMode == 'sfu'){
        const pc = room.getPeerConnection();
        const stats = await pc.getStats();
        printStats(stats, 'sfu');
      }
    });

    function printStats(stats, peerId){
      stats.forEach( stat => {
        console.log('Stats('+peerId+')', stat);
      });
    }

    dpTrigger_fr.addEventListener('click', () => {
      if(roomMode == 'mesh'){
        const pcs = room.getPeerConnections();
        for([peerId, pc] of Object.entries(pcs)){
          const senders = pc.getSenders();
          senders.forEach( async sender => {
            if(sender.track.kind == 'video'){
              console.log('video Parameter', sender.getParameters());
              const setParam = sender.getParameters();
              setParam.degradationPreference = 'maintain-framerate';
              await sender.setParameters(setParam);
              console.log('video Parameter', sender.getParameters());
            }
          });
        }
      } else if(roomMode == 'sfu'){
        console.log('sfu');
        const pc = room.getPeerConnection();
        const senders = pc.getSenders();
        console.log('senders', senders);
        senders.forEach( async sender => {
          if(sender.track && sender.track.kind == 'video'){
            console.log('video Parameter', sender.getParameters());
            const setParam = sender.getParameters();
            setParam.degradationPreference = 'maintain-framerate';
            await sender.setParameters(setParam);
            console.log('video Parameter', sender.getParameters());
          }
        });
      }
    });
    dpTrigger_rsl.addEventListener('click', () => {
      if(roomMode == 'mesh'){
        const pcs = room.getPeerConnections();
        for([peerId, pc] of Object.entries(pcs)){
          const senders = pc.getSenders();
          senders.forEach( async sender => {
            if(sender.track.kind == 'video'){
              console.log('video Parameter', sender.getParameters());
              const setParam = sender.getParameters();
              setParam.degradationPreference = 'maintain-framerate';
              await sender.setParameters(setParam);
              console.log('video Parameter', sender.getParameters());
            }
          });
        }
      } else if(roomMode == 'sfu'){
        console.log('sfu');
        const pc = room.getPeerConnection();
        const senders = pc.getSenders();
        console.log('senders', senders);
        senders.forEach( async sender => {
          if(sender.track && sender.track.kind == 'video'){
            console.log('video Parameter', sender.getParameters());
            const setParam = sender.getParameters();
            setParam.degradationPreference = 'maintain-resolution';
            await sender.setParameters(setParam);
            console.log('video Parameter', sender.getParameters());
          }
        });
      }
    });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();
