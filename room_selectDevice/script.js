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
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');
  const slct_vDevice = document.getElementById('js-vdevices');
  const slct_aDevice = document.getElementById('js-adevices');

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

  async function playLocalStream(_localStream){
    // Render local stream
    localVideo.muted = true;
    localVideo.srcObject = _localStream;
    localVideo.playsInline = true;
    await localVideo.play().catch(console.error);
  }

  //select device
  let localStream;
  localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);
  playLocalStream(localStream);

  const devices = await navigator.mediaDevices.enumerateDevices();

  devices.find( (device) => {
      if(device.kind === "audioinput"){
        const option = document.createElement("option");
        option.text = device.label;
        option.value = device.deviceId;
        slct_aDevice.appendChild(option);
      }
  });
  devices.find( (device) => {
      if(device.kind === "videoinput"){
        const option = document.createElement("option");
        option.text = device.label;
        option.value = device.deviceId;
        slct_vDevice.appendChild(option);
      }
  });

  slct_aDevice.addEventListener('change', async () => {
    localStream = await navigator.mediaDevices
      .getUserMedia({
        audio: { //true,
          deviceId: slct_aDevice.value,
        },
        video: { //true,
          deviceId: slct_vDevice.value,
        },
      })
      .catch(console.error);


    playLocalStream(localStream);
  });
  slct_vDevice.addEventListener('change', async () => {
    localStream = await navigator.mediaDevices
      .getUserMedia({
        audio: { //true,
          deviceId: slct_aDevice.value,
        },
        video: { //true,
          deviceId: slct_vDevice.value,
        },
      })
      .catch(console.error);


    playLocalStream(localStream);
  });

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

    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    //slct_device.removeEventListener('change', ());
    slct_aDevice.addEventListener('change', async () => {
      localStream = await navigator.mediaDevices
        .getUserMedia({
          audio: { //true,
            deviceId: slct_aDevice.value,
          },
          video: { // true,
            deviceId: slct_vDevice.value,
          },
        })
        .catch(console.error);

      //replace to Stream from new device via AudioContext Filter
      const audioContext = new AudioContext();

      const mediaStreamSource = audioContext.createMediaStreamSource(localStream);
      const destination = audioContext.createMediaStreamDestination();
      mediaStreamSource.connect(destination);

      const newLocalStream = new MediaStream();

      localStream.getVideoTracks().forEach( track => newLocalStream.addTrack(track));
      destination.stream.getAudioTracks().forEach( track => newLocalStream.addTrack(track));
      console.log(newLocalStream.getAudioTracks());
      console.log(newLocalStream.getVideoTracks());
      

      playLocalStream(newLocalStream);
      room.replaceStream(newLocalStream);
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

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();
