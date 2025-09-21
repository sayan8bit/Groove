class MusicPlayer {
  constructor() {
    this.songs = [];
    this.filteredSongs = [];
    this.likedSongs = JSON.parse(
      localStorage.getItem("grooveLikedSongs") || "[]"
    );
    this.playlists = JSON.parse(
      localStorage.getItem("groovePlaylists") || "[]"
    );
    this.currentSong = null;
    this.currentPlaylist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.currentView = "songs";
    this.audio = new Audio();
    this.progressUpdateInterval = null;
    this.wakeLock = null;

    // Local storage key for temporary song cache
    this.tempSongCacheKey = "grooveTempSongCache";

    // PWA Audio Session Management
    this.setupMediaSession();
    this.setupWakeLock();

    this.initializeElements();
    this.attachEventListeners();
    this.setupAudio();

    // Load songs from JSON file
    this.loadSongs().then(() => {
      this.render();
      // Hide loading screen after songs are loaded
      setTimeout(() => {
        document.getElementById("loading-screen").style.opacity = "0";
        setTimeout(() => {
          document.getElementById("loading-screen").style.display = "none";
        }, 300);
      }, 500);
    });
  }

  // Load songs from JSON file
  async loadSongs() {
    try {
      const response = await fetch("songs.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.songs = data.songs || [];
      this.filteredSongs = [...this.songs];
      console.log("Songs loaded successfully:", this.songs.length, "songs");
    } catch (error) {
      console.error("Error loading songs:", error);
      this.showError(
        "Failed to load music library. Please check your connection and refresh the page."
      );
      // Fallback to empty array if loading fails
      this.songs = [];
      this.filteredSongs = [];
    }
  }

  // PWA Media Session API for background playback
  setupMediaSession() {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        this.togglePlayPause();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        this.togglePlayPause();
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        this.previousSong();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        this.nextSong();
      });

      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime) {
          this.audio.currentTime = details.seekTime;
          this.updateProgress();
        }
      });
    }
  }

  // Update Media Session metadata
  updateMediaSession() {
    if ("mediaSession" in navigator && this.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentSong.title,
        artist: this.currentSong.artist,
        album: "Groove Music",
        artwork: [
          { src: this.currentSong.coverArt, sizes: "96x96", type: "image/png" },
          {
            src: this.currentSong.coverArt,
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: this.currentSong.coverArt,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: this.currentSong.coverArt,
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: this.currentSong.coverArt,
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: this.currentSong.coverArt,
            sizes: "512x512",
            type: "image/png",
          },
        ],
      });

      // Update playback state
      navigator.mediaSession.playbackState = this.isPlaying
        ? "playing"
        : "paused";

      // Update position state
      if (this.audio.duration) {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.audio.playbackRate,
          position: this.audio.currentTime,
        });
      }
    }
  }

  // Wake Lock API to prevent screen from turning off during playback
  async setupWakeLock() {
    if ("wakeLock" in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request("screen");
        console.log("Wake lock acquired");
      } catch (err) {
        console.log("Wake lock failed:", err);
      }
    }
  }

  async requestWakeLock() {
    if ("wakeLock" in navigator && this.isPlaying) {
      try {
        this.wakeLock = await navigator.wakeLock.request("screen");
      } catch (err) {
        console.log("Wake lock request failed:", err);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  initializeElements() {
    // Navigation
    this.navButtons = {
      songs: document.getElementById("nav-songs"),
      liked: document.getElementById("nav-liked"),
      playlists: document.getElementById("nav-playlists"),
    };

    // Views
    this.views = {
      songs: document.getElementById("all-songs-view"),
      liked: document.getElementById("liked-songs-view"),
      playlists: document.getElementById("playlists-view"),
      playlistDetail: document.getElementById("playlist-detail-view"),
    };

    // Lists
    this.lists = {
      songs: document.getElementById("songs-list"),
      liked: document.getElementById("liked-songs-list"),
      playlists: document.getElementById("playlists-list"),
      playlistSongs: document.getElementById("playlist-songs-list"),
    };

    // Player elements
    this.playerElements = {
      miniPlayer: document.getElementById("mini-player"),
      miniArt: document.getElementById("mini-player-art"),
      miniTitle: document.getElementById("mini-player-title"),
      miniArtist: document.getElementById("mini-player-artist"),
      miniProgress: document.getElementById("mini-progress"),
      miniPlayBtn: document.getElementById("mini-play-btn"),
      miniVisualizer: document.getElementById("mini-player-visualizer"),

      modal: document.getElementById("player-modal"),
      art: document.getElementById("player-art"),
      title: document.getElementById("player-title"),
      artist: document.getElementById("player-artist"),
      progress: document.getElementById("player-progress"),
      currentTime: document.getElementById("current-time"),
      totalTime: document.getElementById("total-time"),
      playBtn: document.getElementById("player-play-btn"),
      prevBtn: document.getElementById("prev-btn"),
      nextBtn: document.getElementById("next-btn"),
      likeBtn: document.getElementById("like-btn"),
      volumeSlider: document.getElementById("volume-slider"),
    };

    // Other elements
    this.searchToggle = document.getElementById("search-toggle");
    this.searchBar = document.getElementById("search-bar");
    this.searchInput = document.getElementById("search-input");
    this.searchClose = document.getElementById("search-close");
    this.headerDefault = document.getElementById("header-default");
  }

  attachEventListeners() {
    // Navigation
    Object.entries(this.navButtons).forEach(([view, button]) => {
      button.addEventListener("click", () => this.switchView(view));
    });

    // Search functionality
    this.searchToggle.addEventListener("click", () => this.toggleSearch());
    this.searchClose.addEventListener("click", () => this.toggleSearch(false));
    this.searchInput.addEventListener("input", (e) =>
      this.handleSearch(e.target.value)
    );

    // Mini player
    this.playerElements.miniPlayer.addEventListener("click", (e) => {
      // Don't open modal if clicking on buttons or progress bar
      if (
        !e.target.closest("button") &&
        !e.target.closest('input[type="range"]')
      ) {
        this.showPlayerModal();
      }
    });
    this.playerElements.miniPlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePlayPause();
    });
    this.playerElements.miniProgress.addEventListener("input", (e) => {
      e.stopPropagation();
      this.seek(e);
    });
    this.playerElements.miniProgress.addEventListener("change", (e) => {
      e.stopPropagation();
      this.seek(e);
    });
    this.playerElements.miniProgress.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    this.playerElements.miniProgress.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
    this.playerElements.miniProgress.addEventListener("touchstart", (e) => {
      e.stopPropagation();
    });

    // Full player
    document
      .getElementById("player-close")
      .addEventListener("click", () => this.hidePlayerModal());
    this.playerElements.playBtn.addEventListener("click", () =>
      this.togglePlayPause()
    );
    this.playerElements.prevBtn.addEventListener("click", () =>
      this.previousSong()
    );
    this.playerElements.nextBtn.addEventListener("click", () =>
      this.nextSong()
    );
    this.playerElements.likeBtn.addEventListener("click", () =>
      this.toggleLike()
    );
    this.playerElements.progress.addEventListener("input", (e) => this.seek(e));
    this.playerElements.volumeSlider.addEventListener("input", (e) => {
      this.audio.volume = e.target.value;
    });
    document
      .getElementById("playlist-add-btn")
      .addEventListener("click", () => this.showAddToPlaylistModal());

    // Playlist functionality
    document
      .getElementById("add-playlist-btn")
      .addEventListener("click", () => this.showCreatePlaylistModal());
    document
      .getElementById("create-playlist")
      .addEventListener("click", () => this.createPlaylist());
    document
      .getElementById("cancel-playlist")
      .addEventListener("click", () => this.hideCreatePlaylistModal());
    document
      .getElementById("close-playlist-modal")
      .addEventListener("click", () => this.hideAddToPlaylistModal());
    document
      .getElementById("back-to-playlists-btn")
      .addEventListener("click", () => this.switchView("playlists"));

    // Add enter key support for playlist creation
    document
      .getElementById("playlist-name-input")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.createPlaylist();
        } else if (e.key === "Escape") {
          this.hideCreatePlaylistModal();
        }
      });

    // Error modal
    document
      .getElementById("close-error")
      .addEventListener("click", () => this.hideErrorModal());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyboard(e));

    // Prevent context menu on long press
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    // Handle visibility change for PWA
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isPlaying) {
        this.requestWakeLock();
      }
    });
  }

  setupAudio() {
    // Enable background audio
    this.audio.preload = "metadata";

    this.audio.addEventListener("loadedmetadata", () => {
      const duration = this.audio.duration;
      this.playerElements.progress.max = duration;
      this.playerElements.miniProgress.max = duration;
      this.playerElements.totalTime.textContent = this.formatTime(duration);

      // Update media session
      this.updateMediaSession();
    });

    this.audio.addEventListener("timeupdate", () => {
      if (!this.audio.paused) {
        this.updateProgress();
        this.updateMediaSession();
      }
    });

    this.audio.addEventListener("ended", () => {
      this.nextSong();
    });

    this.audio.addEventListener("play", () => {
      this.isPlaying = true;
      this.updatePlayButtons();
      this.startVisualizer();
      this.updateMediaSession();
      this.requestWakeLock();
    });

    this.audio.addEventListener("pause", () => {
      this.isPlaying = false;
      this.updatePlayButtons();
      this.stopVisualizer();
      this.updateMediaSession();
      this.releaseWakeLock();
    });

    this.audio.addEventListener("error", (e) => {
      this.showError("Failed to load audio. Please check the song URL.");
      console.error("Audio error:", e);
    });
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  updateProgress() {
    if (this.audio.paused || !this.audio.duration) return;

    const progress = this.audio.currentTime;

    // Update both progress bars
    this.playerElements.progress.value = progress;
    this.playerElements.miniProgress.value = progress;

    // Update time display
    this.playerElements.currentTime.textContent = this.formatTime(progress);
  }

  seek(event = null) {
    // Handle both mini and full player progress bars
    let time;
    if (event && event.target) {
      time = event.target.value;
    } else {
      time =
        this.playerElements.progress.value ||
        this.playerElements.miniProgress.value;
    }
    this.audio.currentTime = parseFloat(time);

    // Update both progress bars to stay in sync
    this.playerElements.progress.value = time;
    this.playerElements.miniProgress.value = time;

    // Update media session position
    this.updateMediaSession();
  }

  toggleSearch(show = null) {
    const isVisible = this.searchBar.classList.contains("opacity-100");
    const shouldShow = show !== null ? show : !isVisible;

    if (shouldShow) {
      // Hide default header content and show search bar
      this.headerDefault.classList.add(
        "opacity-0",
        "transform",
        "scale-95",
        "pointer-events-none"
      );
      this.searchBar.classList.remove(
        "opacity-0",
        "translate-y-2",
        "pointer-events-none"
      );
      this.searchBar.classList.add(
        "opacity-100",
        "translate-y-0",
        "pointer-events-auto"
      );
      setTimeout(() => this.searchInput.focus(), 300);
    } else {
      // Show default header content and hide search bar
      this.searchBar.classList.add(
        "opacity-0",
        "translate-y-2",
        "pointer-events-none"
      );
      this.searchBar.classList.remove(
        "opacity-100",
        "translate-y-0",
        "pointer-events-auto"
      );
      this.headerDefault.classList.remove(
        "opacity-0",
        "transform",
        "scale-95",
        "pointer-events-none"
      );
      this.searchInput.value = "";
      this.handleSearch("");
    }
  }

  handleSearch(query) {
    if (!query.trim()) {
      this.filteredSongs = [...this.songs];
    } else {
      this.filteredSongs = this.songs.filter(
        (song) =>
          song.title.toLowerCase().includes(query.toLowerCase()) ||
          song.artist.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (this.currentView === "songs") {
      this.renderSongs();
    }
  }

  switchView(view) {
    // Update navigation
    Object.values(this.navButtons).forEach((btn) => {
      btn.classList.remove("text-red-500");
      btn.classList.add("text-gray-400", "hover:text-white");
    });

    this.navButtons[view].classList.remove("text-gray-400", "hover:text-white");
    this.navButtons[view].classList.add("text-red-500");

    // Hide all views
    Object.values(this.views).forEach((viewEl) => {
      viewEl.classList.add("hidden");
    });

    // Show selected view
    const viewMap = {
      songs: "songs",
      liked: "liked",
      playlists: "playlists",
    };

    this.views[viewMap[view]].classList.remove("hidden");
    this.currentView = view;
    this.render();
  }

  render() {
    switch (this.currentView) {
      case "songs":
        this.renderSongs();
        break;
      case "liked":
        this.renderLikedSongs();
        break;
      case "playlists":
        this.renderPlaylists();
        break;
    }
    this.updateCounts();
  }

  renderSongs() {
    this.lists.songs.innerHTML = "";
    this.filteredSongs.forEach((song) => {
      this.lists.songs.appendChild(this.createSongElement(song));
    });
  }

  renderLikedSongs() {
    this.lists.liked.innerHTML = "";
    if (this.likedSongs.length === 0) {
      this.lists.liked.innerHTML = `
          <div class="text-center py-16 text-gray-400">
            <i class="fas fa-heart text-4xl mb-4 opacity-50"></i>
            <p class="text-lg font-medium">No liked songs yet</p>
            <p class="text-sm">Songs you like will appear here</p>
          </div>
        `;
      return;
    }
    this.likedSongs.forEach((song) => {
      this.lists.liked.appendChild(this.createSongElement(song));
    });
  }

  renderPlaylists() {
    this.lists.playlists.innerHTML = "";
    if (this.playlists.length === 0) {
      this.lists.playlists.innerHTML = `
          <div class="text-center py-16 text-gray-400">
            <i class="fas fa-list-ul text-4xl mb-4 opacity-50"></i>
            <p class="text-lg font-medium">No playlists yet</p>
            <p class="text-sm">Create a playlist to get started</p>
          </div>
        `;
      return;
    }
    this.playlists.forEach((playlist) => {
      this.lists.playlists.appendChild(this.createPlaylistElement(playlist));
    });
  }

  createSongElement(song) {
    const isLiked = this.likedSongs.some((s) => s.id === song.id);
    const isPlaying = this.currentSong && this.currentSong.id === song.id;

    const element = document.createElement("div");
    element.className = `song-item glass-effect rounded-2xl p-4 flex items-center space-x-4 cursor-pointer transition-all duration-300 hover:bg-white/5 ${
      isPlaying ? "ring-2 ring-red-500/50" : ""
    }`;

    element.innerHTML = `
          <div class="relative">
            <img src="${song.coverArt}" alt="${
      song.title
    }" class="w-14 h-14 rounded-xl object-cover shadow-lg" />
            ${
              isPlaying
                ? '<div class="music-visualizer absolute -top-1 -right-1"><span></span><span></span><span></span><span></span></div>'
                : ""
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white truncate">${
              song.title
            }</p>
            <p class="text-sm text-gray-400 truncate">${song.artist}</p>
          </div>
          <button class="like-btn w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
            isLiked ? "text-red-500" : "text-gray-400 hover:text-red-400"
          }">
            <i class="${isLiked ? "fas" : "far"} fa-heart text-lg"></i>
          </button>
        `;

    const likeBtn = element.querySelector(".like-btn");
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleSongLike(song.id);
    });

    element.addEventListener("click", () => this.playSong(song));

    return element;
  }

  createPlaylistElement(playlist) {
    const element = document.createElement("div");
    element.className =
      "glass-effect rounded-2xl p-4 flex items-center space-x-4 cursor-pointer transition-all duration-300 hover:bg-white/5";

    element.innerHTML = `
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg">
            <i class="fas fa-list-ul text-xl"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white truncate">${
              playlist.name
            }</p>
            <p class="text-sm text-gray-400">${
              playlist.songs.length
            } song${playlist.songs.length !== 1 ? "s" : ""}</p>
          </div>
          <button class="delete-btn w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
            <i class="fas fa-trash text-sm"></i>
          </button>
        `;

    const deleteBtn = element.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.deletePlaylist(playlist.id);
    });

    element.addEventListener("click", () => this.showPlaylistDetail(playlist));

    return element;
  }

  updateCounts() {
    const songsCount = document.getElementById("songs-count");
    const likedCount = document.getElementById("liked-count");

    if (songsCount)
      songsCount.textContent = `${this.filteredSongs.length} songs`;
    if (likedCount) likedCount.textContent = `${this.likedSongs.length} songs`;
  }

  async playSong(song) {
    this.currentSong = song;
    this.currentPlaylist =
      this.filteredSongs.length > 0 ? this.filteredSongs : this.songs;
    this.currentIndex = this.currentPlaylist.findIndex((s) => s.id === song.id);

    try {
      let audioData = localStorage.getItem(this.tempSongCacheKey);

      if (audioData && JSON.parse(audioData).id === song.id) {
        // Song is in local storage, use cached URL
        this.audio.src = JSON.parse(audioData).url;
        console.log("Playing from cache:", song.title);
      } else {
        // Song is not cached, fetch and cache it
        const response = await fetch(song.audioSrc);
        if (!response.ok) throw new Error("Failed to fetch audio file");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        // Save the blob data and the song ID to local storage
        localStorage.setItem(this.tempSongCacheKey, JSON.stringify({ id: song.id, url: objectUrl }));
        
        this.audio.src = objectUrl;
        console.log("Fetched and cached:", song.title);
      }
      
      this.audio.play().catch((error) => {
        this.showError(
          "Unable to play this song. Please check your internet connection or try another song."
        );
        console.error("Playback error:", error);
      });

    } catch (error) {
      this.showError(
        "Failed to load audio. Please check the song URL."
      );
      console.error("Audio caching/playback error:", error);
      this.audio.src = song.audioSrc;
      this.audio.play().catch(e => {
        this.showError("Playback failed. Please try again.");
        console.error("Fallback playback error:", e);
      });
    }

    this.updatePlayerUI();
    this.showMiniPlayer();
    this.render(); // Re-render to update playing states
  }

  togglePlayPause() {
    if (!this.currentSong) return;

    if (this.audio.paused) {
      this.audio.play().catch((error) => {
        this.showError("Playback failed. Please try again.");
        console.error("Play error:", error);
      });
    } else {
      this.audio.pause();
    }
  }

  previousSong() {
    if (!this.currentPlaylist.length) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.currentPlaylist.length) %
      this.currentPlaylist.length;
    this.playSong(this.currentPlaylist[this.currentIndex]);
  }

  nextSong() {
    if (!this.currentPlaylist.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.currentPlaylist.length;
    this.playSong(this.currentPlaylist[this.currentIndex]);
  }

  toggleLike() {
    if (!this.currentSong) return;
    this.toggleSongLike(this.currentSong.id);
  }

  toggleSongLike(songId) {
    const song = this.songs.find((s) => s.id === songId);
    if (!song) return;

    const isLiked = this.likedSongs.some((s) => s.id === songId);
    if (isLiked) {
      this.likedSongs = this.likedSongs.filter((s) => s.id !== songId);
    } else {
      this.likedSongs.push(song);
    }

    this.saveData();
    this.updateLikeButton();
    this.render();
  }

  updatePlayerUI() {
    if (!this.currentSong) return;

    const { title, artist, coverArt } = this.currentSong;

    // Mini player
    this.playerElements.miniTitle.textContent = title;
    this.playerElements.miniArtist.textContent = artist;
    this.playerElements.miniArt.src = coverArt;

    // Full player
    this.playerElements.title.textContent = title;
    this.playerElements.artist.textContent = artist;
    this.playerElements.art.src = coverArt;

    this.updateLikeButton();
    this.updateMediaSession();
  }

  updateLikeButton() {
    if (!this.currentSong) return;

    const isLiked = this.likedSongs.some((s) => s.id === this.currentSong.id);
    const icon = this.playerElements.likeBtn.querySelector("i");

    if (isLiked) {
      icon.className = "fas fa-heart";
      this.playerElements.likeBtn.className =
        "w-12 h-12 flex items-center justify-center text-2xl text-red-500 transition-all duration-300";
    } else {
      icon.className = "far fa-heart";
      this.playerElements.likeBtn.className =
        "w-12 h-12 flex items-center justify-center text-2xl text-gray-400 hover:text-red-400 transition-all duration-300";
    }
  }

  updatePlayButtons() {
    const icon = this.isPlaying ? "fa-pause" : "fa-play";
    const miniIcon = this.playerElements.miniPlayBtn.querySelector("i");
    const playerIcon = this.playerElements.playBtn.querySelector("i");

    miniIcon.className = `fas ${icon} text-lg ${
      this.isPlaying ? "" : "ml-0.5"
    }`;
    playerIcon.className = `fas ${icon} text-2xl ${
      this.isPlaying ? "" : "ml-1"
    }`;
  }

  startVisualizer() {
    this.playerElements.miniVisualizer.classList.remove("opacity-0");
    this.playerElements.miniVisualizer.classList.add("opacity-100");
  }

  stopVisualizer() {
    this.playerElements.miniVisualizer.classList.add("opacity-0");
    this.playerElements.miniVisualizer.classList.remove("opacity-100");
  }

  showMiniPlayer() {
    this.playerElements.miniPlayer.classList.remove(
      "translate-y-full",
      "opacity-0"
    );
    this.playerElements.miniPlayer.classList.add(
      "translate-y-0",
      "opacity-100"
    );
  }

  showPlayerModal() {
    this.playerElements.modal.classList.remove("hidden");
    this.playerElements.modal.classList.add("modal-enter");
    document.body.style.overflow = "hidden";
  }

  hidePlayerModal() {
    this.playerElements.modal.classList.add("modal-exit");
    setTimeout(() => {
      this.playerElements.modal.classList.add("hidden");
      this.playerElements.modal.classList.remove("modal-enter", "modal-exit");
      document.body.style.overflow = "";
    }, 300);
  }

  showCreatePlaylistModal() {
    document.getElementById("create-playlist-modal").classList.remove("hidden");
    document.getElementById("playlist-name-input").focus();
  }

  hideCreatePlaylistModal() {
    document.getElementById("create-playlist-modal").classList.add("hidden");
  }

  showAddToPlaylistModal() {
    if (!this.currentSong) {
      this.showError("Please select a song first");
      return;
    }

    const modal = document.getElementById("add-to-playlist-modal");
    const options = document.getElementById("playlist-options");

    options.innerHTML = "";

    if (this.playlists.length === 0) {
      options.innerHTML = `
          <div class="text-center py-8 text-gray-400">
            <i class="fas fa-list-ul text-2xl mb-2 opacity-50"></i>
            <p class="text-sm">No playlists available</p>
            <p class="text-xs mt-1">Create a playlist first</p>
          </div>
        `;
    } else {
      this.playlists.forEach((playlist) => {
        const inPlaylist = playlist.songs.includes(this.currentSong.id);
        const option = document.createElement("div");
        option.className =
          "flex items-center justify-between p-3 glass-effect rounded-xl cursor-pointer hover:bg-white/5 transition-colors";
        option.innerHTML = `
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-xs">
                  <i class="fas fa-list-ul"></i>
                </div>
                <span class="text-white font-medium">${
                  playlist.name
                }</span>
              </div>
              <i class="fas ${
                inPlaylist
                  ? "fa-check text-green-400"
                  : "fa-plus text-gray-400"
              } text-lg transition-colors"></i>
            `;

        option.addEventListener("click", () => {
          if (inPlaylist) {
            this.removeFromPlaylist(playlist.id, this.currentSong.id);
          } else {
            this.addToPlaylist(playlist.id, this.currentSong.id);
          }
          // Refresh the modal immediately
          setTimeout(() => {
            this.showAddToPlaylistModal();
          }, 100);
        });

        options.appendChild(option);
      });
    }

    modal.classList.remove("hidden");
  }

  hideAddToPlaylistModal() {
    document.getElementById("add-to-playlist-modal").classList.add("hidden");
  }

  createPlaylist() {
    const input = document.getElementById("playlist-name-input");
    const name = input.value.trim();

    if (!name) {
      input.focus();
      input.classList.add("ring-2", "ring-red-500");
      setTimeout(() => {
        input.classList.remove("ring-2", "ring-red-500");
      }, 1500);
      return;
    }

    // Check for duplicate names
    if (
      this.playlists.some((p) => p.name.toLowerCase() === name.toLowerCase())
    ) {
      this.showError("A playlist with this name already exists");
      return;
    }

    const playlist = {
      id: Date.now().toString(),
      name,
      songs: [],
    };

    this.playlists.push(playlist);
    this.saveData();
    this.hideCreatePlaylistModal();

    // Show success message
    this.showToast(`Created playlist "${name}"`);

    // Switch to playlists view to show the new playlist
    this.switchView("playlists");

    input.value = "";
  }

  deletePlaylist(playlistId) {
    this.playlists = this.playlists.filter((p) => p.id !== playlistId);
    this.saveData();
    this.render();
  }

  addToPlaylist(playlistId, songId) {
    const playlist = this.playlists.find((p) => p.id === playlistId);
    const song = this.songs.find((s) => s.id === songId);

    if (playlist && song && !playlist.songs.includes(songId)) {
      playlist.songs.push(songId);
      this.saveData();

      // Show success feedback
      this.showToast(`Added "${song.title}" to "${playlist.name}"`);
    }
  }

  removeFromPlaylist(playlistId, songId) {
    const playlist = this.playlists.find((p) => p.id === playlistId);
    const song = this.songs.find((s) => s.id === songId);

    if (playlist && song) {
      playlist.songs = playlist.songs.filter((s) => s !== songId);
      this.saveData();

      // Show success feedback
      this.showToast(`Removed "${song.title}" from "${playlist.name}"`);
    }
  }

  showToast(message) {
    // Remove any existing toast
    const existingToast = document.querySelector(".toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className =
      "toast fixed top-20 left-1/2 transform -translate-x-1/2 glass-effect px-4 py-2 rounded-xl text-white text-sm font-medium z-[90] opacity-0 transition-all duration-300";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => {
      toast.classList.remove("opacity-0");
      toast.classList.add("opacity-100");
    }, 100);

    // Hide toast after 2 seconds
    setTimeout(() => {
      toast.classList.remove("opacity-100");
      toast.classList.add("opacity-0");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 2000);
  }

  showPlaylistDetail(playlist) {
    const title = document.getElementById("playlist-detail-title");
    title.textContent = playlist.name;
    title.dataset.playlistId = playlist.id;

    this.lists.playlistSongs.innerHTML = "";

    if (playlist.songs.length === 0) {
      this.lists.playlistSongs.innerHTML = `
          <div class="text-center py-16 text-gray-400">
            <i class="fas fa-music text-4xl mb-4 opacity-50"></i>
            <p class="text-lg font-medium">Empty playlist</p>
            <p class="text-sm">Add songs to this playlist</p>
          </div>
        `;
    } else {
      const playlistSongs = playlist.songs
        .map((id) => this.songs.find((s) => s.id === id))
        .filter(Boolean);
      playlistSongs.forEach((song) => {
        const element = this.createSongElement(song);
        // Add remove button for playlist songs
        const removeBtn = document.createElement("button");
        removeBtn.className =
          "w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors ml-2";
        removeBtn.innerHTML = '<i class="fas fa-times text-sm"></i>';
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.removeFromPlaylist(playlist.id, song.id);
          this.showPlaylistDetail(playlist); // Refresh
        });

        element.appendChild(removeBtn);
        this.lists.playlistSongs.appendChild(element);
      });
    }

    this.views.playlistDetail.classList.remove("hidden");
    Object.values(this.views).forEach((view) => {
      if (view !== this.views.playlistDetail) view.classList.add("hidden");
    });
  }

  showError(message) {
    document.getElementById("error-message").textContent = message;
    document.getElementById("error-modal").classList.remove("hidden");
  }

  hideErrorModal() {
    document.getElementById("error-modal").classList.add("hidden");
  }

  handleKeyboard(e) {
    if (e.target.tagName === "INPUT") return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        this.togglePlayPause();
        break;
      case "ArrowRight":
        e.preventDefault();
        this.nextSong();
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.previousSong();
        break;
      case "KeyL":
        e.preventDefault();
        this.toggleLike();
        break;
    }
  }

  saveData() {
    localStorage.setItem("grooveLikedSongs", JSON.stringify(this.likedSongs));
    localStorage.setItem("groovePlaylists", JSON.stringify(this.playlists));
  }
}

// Initialize the music player when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.musicPlayer = new MusicPlayer();
});
