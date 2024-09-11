// mcsrvstat.us
export interface MCSrvStatResponse {
	ip: string
	port: number
	debug: Debug
	motd: MOTD
	players: Players
	version: string
	online: boolean
	protocol: Protocol
	hostname: string
	icon: string
	eula_blocked: boolean
}

export interface Debug {
	ping: boolean
	query: boolean
	srv: boolean
	querymismatch: boolean
	ipinsrv: boolean
	cnameinsrv: boolean
	animatedmotd: boolean
	cachehit: boolean
	cachetime: number
	cacheexpire: number
	apiversion: number
	dns: DNS
	error: Error
}

export interface DNS {
	aaaa: Aaaa[]
}

export interface Aaaa {
	name: string
	type: string
	class: string
	ttl: number
	rdlength: number
	rdata: string
	address?: string
	typecovered?: string
	algorithm?: number
	labels?: number
	origttl?: number
	sigexp?: string
	sigincep?: string
	keytag?: number
	signname?: string
	signature?: string
}

export interface Error {
	query: string
}

export interface MOTD {
	raw: string[]
	clean: string[]
	html: string[]
}

export interface Players {
	online: number
	max: number
	list: List[]
}

export interface List {
	name: string
	uuid: string
}

export interface Protocol {
	version: number
	name: string
}
