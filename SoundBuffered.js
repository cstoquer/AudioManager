var inherits = require('util').inherits;
var ISound   = require('./ISound.js');

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/** Audio wrapper using AudioBufferSourceNode
 * @author  Cedric Stoquer
 * 
 */
function SoundBuffered() {
	ISound.call(this);

	this.playing         = false;
	this.buffer          = null;
	this.source          = null;
	this.sourceConnector = null;
	this.gain            = null;
	this.panNode         = null;
	this.rawAudioData    = null;

	this._playPitch      = 0.0;
	this._fadeTimeout    = null;

	if (this.audioContext) { this.init(); }
}
inherits(SoundBuffered, ISound);
module.exports = SoundBuffered;


SoundBuffered.prototype.init = function () {
	var self = this;

	// create webAudio nodes
	// source -> gain -> pan -> destination

	var audioContext = this.audioContext;
	var gainNode     = audioContext.createGain();
	var panNode;

	if (audioContext.createStereoPanner) {
		panNode = audioContext.createStereoPanner();
	} else {
		// fallback to 3D PannerNode
		panNode = audioContext.createPanner();
	}

	gainNode.connect(panNode);
	panNode.connect(audioContext.destination);
	gainNode.gain.value        = 0;
	gainNode.gain.defaultValue = 0;

	this.sourceConnector = gainNode;
	this.gain            = gainNode.gain;
	this.panNode         = panNode;

	function onAudioDecodeSuccess(buffer) {
		self.buffer = buffer;
		self.usedMemory = buffer.duration;
		self.audioManager.usedMemory += buffer.duration;
		self.rawAudioData = null;
		if (self._loaded && self._playTriggered) {
			if (self.loop || Date.now() - self._playTriggered < maxPlayLatency) { self._play(); }
			self._playTriggered = 0;
		}
	}

	function onAudioDecodeFail() {
		console.error('decode audio failed for sound ', self.id);
	}

	if (this.rawAudioData) {
		audioContext.decodeAudioData(this.rawAudioData, onAudioDecodeSuccess, onAudioDecodeFail);
	}
};


//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
SoundBuffered.prototype.setVolume = function (value) {
	this.volume = value;
	if (!this.playing) return;
	this.gain.setTargetAtTime(value, this.audioContext.currentTime, this.fade);
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
SoundBuffered.prototype.setPan = function (value) {
	this.pan = value;
	if (this.panNode.pan) {
		// stereo panning
		this.panNode.pan.value = value;
	} else {
		// 3D panning
		this.panNode.setPosition(value, 0, 0.2);
	}
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
SoundBuffered.prototype.setLoop = function (value) {
	this.loop = value;
	if (this.source && this.buffer) {
		this.source.loop      = value;
		this.source.loopStart = 0;
		this.source.loopEnd   = this.buffer.duration;
	}
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/** Set sound pitch
 *
 * @param {number} pitch        - pitch in semi-tone
 * @param {number} [portamento] - duration to slide from previous to new pitch.
 */
SoundBuffered.prototype.setPitch = function (pitch, portamento) {
	this.pitch = pitch;
	this._setPlaybackRate(pitch, portamento);
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
SoundBuffered.prototype._setPlaybackRate = function (pitch, portamento) {
	if (!this.source) return;
	var rate = Math.pow(2, (this._playPitch + pitch) / 12);
	portamento = portamento || 0;
	this.source.playbackRate.setTargetAtTime(rate, this.audioContext.currentTime, portamento);
};


//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/** Load sound
 * @private
 *
 * @param {String} filePath - audio file to be loaded
 */
SoundBuffered.prototype._load = function (filePath) {
	var self = this;

	function loadFail() {
		// TODO: keep track that loading has failed so we don't retry to load it ?
		self._finalizeLoad('Sound could not be loaded.');
	}

	function onAudioLoaded(buffer) {
		self.buffer = buffer;
		self.usedMemory = buffer.duration;
		self.audioManager.usedMemory += buffer.duration;
		self._finalizeLoad(null);
	}

	function loadAudio(uri) {
		var xobj = new XMLHttpRequest();
		xobj.responseType = 'arraybuffer';

		xobj.onreadystatechange = function onXhrStateChange() {
			if (~~xobj.readyState !== 4) { return; }
			if (~~xobj.status !== 200 && ~~xobj.status !== 0) {
				return loadFail();
			}
			if (self.audioContext) {
				self.audioContext.decodeAudioData(xobj.response, onAudioLoaded, loadFail);
			} else {
				self.rawAudioData = xobj.response;
				self._finalizeLoad(null);
			}
		};
		xobj.open('GET', uri, true);
		xobj.send();
	}

	if (window.wizAssets) {
		window.wizAssets.downloadFile(filePath, this._src, loadAudio, loadFail);
	} else {
		loadAudio(filePath);
	}
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/** Unload sound from memory */
SoundBuffered.prototype.unload = function () {
	if (ISound.prototype.unload.call(this)) {
		this.buffer = null;
		this.gain.setTargetAtTime(0, this.audioContext.currentTime, 0);
	}
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/** Play sound. If sound is not yet loaded, it is loaded in memory and flagged to be played
 *  once loading has finished. If loading take too much time, playback may be cancelled.
 */
SoundBuffered.prototype._play = function (pitch) {
	if (!this.buffer) {
		this._playTriggered = Date.now();
		return;
	}

	// prevent a looped sound to play twice
	if (this.loop && this.playing) {
		// TODO: restart sound from beginning
		// update pitch if needed
		if ((pitch || pitch === 0) && pitch !== this._playPitch) {
			this._playPitch = pitch;
			this._setPlaybackRate(this.pitch + this._playPitch, 0);
		}
		return;
	}

	// if sound is still in fade out, 
	if (this._fadeTimeout) {
		this.source.onended = null;
		this.source.stop(0);
		window.clearTimeout(this._fadeTimeout);
		this._fadeTimeout = null;
	}

	this.playing = true;
	this.gain.setTargetAtTime(this.volume, this.audioContext.currentTime, this.fade);

	var sourceNode = this.source = this.audioContext.createBufferSource();
	sourceNode.connect(this.sourceConnector);

	var self = this;
	sourceNode.onended = function onPlaybackEnd() {
		self.playing       = false;
		sourceNode.onended = null;
		self.source        = null;
	};

	this._playPitch = pitch || 0;
	if (pitch || this.pitch) {
		this._setPlaybackRate(this.pitch + this._playPitch, 0);
	}

	sourceNode.loop      = this.loop;
	sourceNode.buffer    = this.buffer;
	sourceNode.loopStart = 0;
	sourceNode.loopEnd   = this.buffer.duration;
	sourceNode.start(0);
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/** Stop sound
 *
 * @param {Function} [cb] - optional callback function
 */
SoundBuffered.prototype.stop = function (cb) {
	var fadeOutRatio = this.audioManager.settings.fadeOutRatio;
	if (!this.playing) { return cb && cb(); }
	this._playTriggered = 0;
	this.playing = false;
	if (!this.source) { return cb && cb(); }

	var self = this;
	function stopSound() {
		self.source.onended = null;
		self.source.stop(0);
		self.source = null;
		self._fadeTimeout = null;
		return cb && cb();
	}

	if (this.fade) {
		this.gain.setTargetAtTime(0, this.audioContext.currentTime, this.fade * fadeOutRatio);
		this._fadeTimeout = window.setTimeout(stopSound, this.fade * 1000);
		return;
	}

	stopSound();
};

