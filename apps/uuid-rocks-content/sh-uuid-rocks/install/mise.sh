#!/bin/sh
set -eu

# https://mise.run

#region logging setup
if [ "${MISE_DEBUG-}" = "true" ] || [ "${MISE_DEBUG-}" = "1" ]; then
	debug() {
		echo "$@" >&2
	}
else
	debug() {
		:
	}
fi

if [ "${MISE_QUIET-}" = "1" ] || [ "${MISE_QUIET-}" = "true" ]; then
	info() {
		:
	}
else
	info() {
		echo "$@" >&2
	}
fi

error() {
	echo "$@" >&2
	exit 1
}
#endregion

#region environment setup
get_os() {
	os="$(uname -s)"
	if [ "$os" = Darwin ]; then
		echo "macos"
	elif [ "$os" = Linux ]; then
		echo "linux"
	else
		error "unsupported OS: $os"
	fi
}

get_arch() {
	musl=""
	if type ldd >/dev/null 2>/dev/null; then
		libc=$(ldd /bin/ls | grep 'musl' | head -1 | cut -d ' ' -f1)
		if [ -n "$libc" ]; then
			musl="-musl"
		fi
	fi
	arch="$(uname -m)"
	if [ "$arch" = x86_64 ]; then
		echo "x64$musl"
	elif [ "$arch" = aarch64 ] || [ "$arch" = arm64 ]; then
		echo "arm64$musl"
	elif [ "$arch" = armv7l ]; then
		echo "armv7$musl"
	else
		error "unsupported architecture: $arch"
	fi
}

shasum_bin() {
	if command -v shasum >/dev/null 2>&1; then
		echo "shasum"
	elif command -v sha256sum >/dev/null 2>&1; then
		echo "sha256sum"
	else
		error "mise install requires shasum or sha256sum but neither is installed. Aborting."
	fi
}

get_checksum() {
	version=$1
	os="$(get_os)"
	arch="$(get_arch)"
	url="https://github.com/jdx/mise/releases/download/${version}/SHASUMS256.txt"

	# For current version use static checksum otherwise
	# use checksum from releases
	if [ "$version" = "v2024.9.0" ]; then
		checksum_linux_x86_64="07dfbed8fe551b3fca5fdb38c9c029654d62c4add31243cedb5c532332d446ce  ./mise-v2024.9.0-linux-x64.tar.gz"
		checksum_linux_x86_64_musl="2cdecb62e37a9770859ee671bb96a207ea9d4bfb6c6ca41e63f8a01ecf6927eb  ./mise-v2024.9.0-linux-x64-musl.tar.gz"
		checksum_linux_arm64="7491387b023fe179cac1048de892914712134da803c4ceeff85f570b76f3c3e4  ./mise-v2024.9.0-linux-arm64.tar.gz"
		checksum_linux_arm64_musl="b327241fb15bffcbe4a00cd0d45acf1ef7f05c9a527b94f58b36f1950990a33b  ./mise-v2024.9.0-linux-arm64-musl.tar.gz"
		checksum_linux_armv7="1578ad0604a4f81f606c4b344861d479fae4fcbbeee685535c8425f6c99dca6a  ./mise-v2024.9.0-linux-armv7.tar.gz"
		checksum_linux_armv7_musl="b16643684534b7952e988ddd84351928a602fea6d682128c4057e2bde5003933  ./mise-v2024.9.0-linux-armv7-musl.tar.gz"
		checksum_macos_x86_64="1ff2f47df636a6c1d3c52c95d41c373f689f6e6c950709c78c31e40ac3b4098f  ./mise-v2024.9.0-macos-x64.tar.gz"
		checksum_macos_arm64="270fde3b85a0d28e57daf26118005108297eb71e281c3abbe66dcadc2b4430c9  ./mise-v2024.9.0-macos-arm64.tar.gz"

		if [ "$os" = "linux" ]; then
			if [ "$arch" = "x64" ]; then
				echo "$checksum_linux_x86_64"
			elif [ "$arch" = "x64-musl" ]; then
				echo "$checksum_linux_x86_64_musl"
			elif [ "$arch" = "arm64" ]; then
				echo "$checksum_linux_arm64"
			elif [ "$arch" = "arm64-musl" ]; then
				echo "$checksum_linux_arm64_musl"
			elif [ "$arch" = "armv7" ]; then
				echo "$checksum_linux_armv7"
			elif [ "$arch" = "armv7-musl" ]; then
				echo "$checksum_linux_armv7_musl"
			else
				warn "no checksum for $os-$arch"
			fi
		elif [ "$os" = "macos" ]; then
			if [ "$arch" = "x64" ]; then
				echo "$checksum_macos_x86_64"
			elif [ "$arch" = "arm64" ]; then
				echo "$checksum_macos_arm64"
			else
				warn "no checksum for $os-$arch"
			fi
		else
			warn "no checksum for $os-$arch"
		fi
	else
		if command -v curl >/dev/null 2>&1; then
			debug ">" curl -fsSL "$url"
			checksums="$(curl -fsSL "$url")"
		else
			if command -v wget >/dev/null 2>&1; then
				debug ">" wget -qO - "$url"
				stderr=$(mktemp)
				checksums="$(wget -qO - "$url")"
			else
				error "mise standalone install specific version requires curl or wget but neither is installed. Aborting."
			fi
		fi

		checksum="$(echo "$checksums" | grep "$os-$arch.tar.gz")"
		if ! echo "$checksum" | grep -Eq "^([0-9a-f]{32}|[0-9a-f]{64})"; then
			warn "no checksum for mise $version and $os-$arch"
		else
			echo "$checksum"
		fi
	fi
}

#endregion

download_file() {
	url="$1"
	filename="$(basename "$url")"
	cache_dir="$(mktemp -d)"
	file="$cache_dir/$filename"

	info "mise: installing mise..."

	if command -v curl >/dev/null 2>&1; then
		debug ">" curl -#fLo "$file" "$url"
		curl -#fLo "$file" "$url"
	else
		if command -v wget >/dev/null 2>&1; then
			debug ">" wget -qO "$file" "$url"
			stderr=$(mktemp)
			wget -O "$file" "$url" >"$stderr" 2>&1 || error "wget failed: $(cat "$stderr")"
		else
			error "mise standalone install requires curl or wget but neither is installed. Aborting."
		fi
	fi

	echo "$file"
}

install_mise() {
	version="${MISE_VERSION:-v2024.9.0}"
	os="$(get_os)"
	arch="$(get_arch)"
	install_path="${MISE_INSTALL_PATH:-$HOME/.local/bin/mise}"
	install_dir="$(dirname "$install_path")"
	tarball_url="https://github.com/jdx/mise/releases/download/${version}/mise-${version}-${os}-${arch}.tar.gz"

	cache_file=$(download_file "$tarball_url")
	debug "mise-setup: tarball=$cache_file"

	debug "validating checksum"
	cd "$(dirname "$cache_file")" && get_checksum "$version" | "$(shasum_bin)" -c >/dev/null

	# extract tarball
	mkdir -p "$install_dir"
	rm -rf "$install_path"
	cd "$(mktemp -d)"
	tar -xzf "$cache_file"
	mv mise/bin/mise "$install_path"
	info "mise: installed successfully to $install_path"
}

after_finish_help() {
	case "${SHELL:-}" in
	*/zsh)
		info "mise: run the following to activate mise in your shell:"
		info "echo \"eval \\\"\\\$($install_path activate zsh)\\\"\" >> \"${ZDOTDIR-$HOME}/.zshrc\""
		info ""
		info "mise: this must be run in order to use mise in the terminal"
		info "mise: run \`mise doctor\` to verify this is setup correctly"
		;;
	*/bash)
		info "mise: run the following to activate mise in your shell:"
		info "echo \"eval \\\"\\\$($install_path activate bash)\\\"\" >> ~/.bashrc"
		info ""
		info "mise: this must be run in order to use mise in the terminal"
		info "mise: run \`mise doctor\` to verify this is setup correctly"
		;;
	*/fish)
		info "mise: run the following to activate mise in your shell:"
		info "echo \"$install_path activate fish | source\" >> ~/.config/fish/config.fish"
		info ""
		info "mise: this must be run in order to use mise in the terminal"
		info "mise: run \`mise doctor\` to verify this is setup correctly"
		;;
	*)
		info "mise: run \`$install_path --help\` to get started"
		;;
	esac
}

install_mise
after_finish_help
