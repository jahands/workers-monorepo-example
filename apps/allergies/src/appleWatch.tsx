import { css, Style } from 'hono/css'

import { getAllergyData, sortAllergiesBySeverity } from './allergies'
import { getHighestSeverity } from './schema'
import { getSeverityFor } from './severity'
import { getWeatherData } from './weather'

import type { Context } from 'hono'
import type { FC } from 'hono/jsx'
import type { Allergy, AllergySeverity } from './schema'
import type { App, AppContext } from './types'
import type { WeatherResponse } from './weather'

async function catchError<T>(c: AppContext, name: string, fn: () => Promise<T>): Promise<T | null> {
	try {
		return await fn()
	} catch (e) {
		c.var.logger?.error(`caught error in ${name}`, { error: e })
		c.var.sentry?.captureException(e)
		return null
	}
}

export async function getAllergyReportAppleShortcut(c: Context<App>): Promise<Response> {
	const start = Date.now()
	const [allergyData, weatherData] = await Promise.all([
		getAllergyData(c),
		catchError(c, 'getWeatherData', () => getWeatherData(c)),
	])
	const allergies = sortAllergiesBySeverity(allergyData.allergens)
	c.var.logger?.debug('data for apple shortcut', {
		duration: Date.now() - start,
		msc: {
			allergyData,
			weatherData,
		},
	})
	return c.html(<WatchAllergyWeatherPage allergies={allergies} weather={weatherData} />)
}

function severityClass(s: AllergySeverity, noFontSize = false) {
	return `${noFontSize ? '' : 'severity '}severity-${s.toLowerCase().replace(' ', '-')}`
}

const WatchAllergyWeatherPage: FC<{
	allergies: Array<[string, Allergy]>
	weather: WeatherResponse | null
}> = (props: { allergies: Array<[string, Allergy]>; weather: WeatherResponse | null }) => {
	return (
		<Layout>
			<div>
				<ul class="press">
					<AllergyTable allergies={props.allergies} />
					<WeatherTable weather={props.weather} />
				</ul>
			</div>
		</Layout>
	)
}

const AllergyTable: FC<{
	allergies: Array<[string, Allergy]>
}> = (props: { allergies: Array<[string, Allergy]> }) => {
	return (
		<>
			{props.allergies.map(([allergyType, allergy]) => {
				const last24HourSeverity = allergy['24_hour_severity']
				// We skip the latest datapoint because it's always 0 (no data yet)
				const last12HourSeverity = getSeverityFor(
					allergy.misery.slice(-13, -1).reduce((a, b) => a + b, 0) / 12,
					'allergy_misery'
				)
				const last6HourSeverity = getSeverityFor(
					allergy.misery.slice(-7, -1).reduce((a, b) => a + b, 0) / 6,
					'allergy_misery'
				)
				const show6h = last6HourSeverity !== last12HourSeverity
				// If 6h is shown, then show 12h so we don't get confused
				const show12h = show6h || last12HourSeverity !== last24HourSeverity

				return (
					<li>
						<div>
							<h1 class={severityClass(last24HourSeverity, true)} style={{ textAlign: 'center' }}>
								{allergyType}
							</h1>
							<table>
								<tbody>
									<tr class={severityClass(last24HourSeverity)}>
										<td style={{ textAlign: 'right' }}>
											<h3 style={{ fontWeight: 'bold' }}>24h:</h3>
										</td>
										<td>
											<h3>{last24HourSeverity}</h3>
										</td>
									</tr>
									{show12h ? (
										<tr class={severityClass(last12HourSeverity)}>
											<td style={{ textAlign: 'right' }}>
												<h3 style={{ fontWeight: 'bold' }}>12h:</h3>
											</td>
											<td>
												<h3>{last12HourSeverity}</h3>
											</td>
										</tr>
									) : null}
									{show6h ? (
										<tr class={severityClass(last6HourSeverity)}>
											<td style={{ textAlign: 'right' }}>
												<h3 style={{ fontWeight: 'bold' }}>6h:</h3>
											</td>
											<td>
												<h3>{last6HourSeverity}</h3>
											</td>
										</tr>
									) : null}
								</tbody>
							</table>
						</div>
					</li>
				)
			})}
		</>
	)
}

const WeatherTable: FC<{
	weather: WeatherResponse | null
}> = (props: { weather: WeatherResponse | null }) => {
	if (!props.weather) return <></>

	const weatherUnits = props.weather.current_units
	const weatherUnitsDay = props.weather.daily_units
	const temp = `${props.weather.current.temperature_2m}${weatherUnits.temperature_2m}`
	const tempLow = `${props.weather.daily.temperature_2m_min[0]}${weatherUnitsDay.temperature_2m_min}`
	const tempHigh = `${props.weather.daily.temperature_2m_max[0]}${weatherUnitsDay.temperature_2m_max}`
	const feelsLike = `${props.weather.current.apparent_temperature}${weatherUnits.apparent_temperature}`
	const humidity = `${props.weather.current.relative_humidity_2m}%`
	const dailyUVIndex = `${props.weather.daily.uv_index_max[0]}${weatherUnitsDay.uv_index_max}`
	const uvIndex = `${props.weather.current.uv_index}${weatherUnits.uv_index}`
	const windSpeed = `${props.weather.current.wind_speed_10m}${weatherUnits.wind_speed_10m}`

	const weatherRows: Array<[label: string, value: string, AllergySeverity]> = [
		['Temp:', temp, getSeverityFor(props.weather.current.temperature_2m, 'temp')],
		['Feel:', feelsLike, getSeverityFor(props.weather.current.apparent_temperature, 'temp')],
		['Humid:', humidity, getSeverityFor(props.weather.current.relative_humidity_2m, 'humidity')],
		['UV:', uvIndex, getSeverityFor(props.weather.current.uv_index, 'uv')],
		['Wind:', windSpeed, 'Low'],
	]

	// Severity is based on temp only
	const weatherSeverity = getHighestSeverity(weatherRows.slice(0, 2).map((r) => r[2]))

	const forecastRows: Array<[label: string, value: string, AllergySeverity]> = [
		['Low:', tempLow, getSeverityFor(props.weather.daily.temperature_2m_min[0], 'temp')],
		['High:', tempHigh, getSeverityFor(props.weather.daily.temperature_2m_max[0], 'temp')],
		['UV:', dailyUVIndex, getSeverityFor(props.weather.daily.uv_index_max[0], 'uv')],
	]
	const forecastSeverity = getHighestSeverity(forecastRows.slice(0, 2).map((r) => r[2]))

	return (
		<>
			<li>
				<div>
					<h1 class={severityClass(weatherSeverity, true)} style={{ textAlign: 'center' }}>
						Weather
					</h1>
					<table>
						<tbody>
							{weatherRows.map((row) => (
								<tr class={severityClass(row[2])}>
									<td style={{ textAlign: 'right' }}>
										<h3 style={{ fontWeight: 'bold' }}>{row[0]}</h3>
									</td>
									<td>
										<h3>{row[1]}</h3>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</li>
			<li>
				<div>
					<h1 class={severityClass(forecastSeverity, true)} style={{ textAlign: 'center' }}>
						Forecast
					</h1>
					<table>
						<tbody>
							{forecastRows.map((row) => (
								<tr class={severityClass(row[2])}>
									<td style={{ textAlign: 'right' }}>
										<h3 style={{ fontWeight: 'bold' }}>{row[0]}</h3>
									</td>
									<td>
										<h3>{row[1]}</h3>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</li>
		</>
	)
}

const Layout: FC = (props) => {
	return (
		<html>
			<head>
				<title>Allergies</title>
				<Style>{css`
					html {
						font-family: Helvetica, Arial, sans-serif;
						background-color: black;
						color: #a4a4a4;
					}
					div {
						font-size: 10vw;
						text-align: left;
						text-justify;
						inter-character;
					}

					div:after {
						content: '';
						display: inline-block;
						width: 100%;
					}
					.severity {
						font-size: 10vw;
					}
					.severity-very-high {
						// This used to be #990000 but I didn't like how dark it was.
						// Changed it to be the same as High and underlined.
						color: #ff0000;
						text-decoration: underline;
						// text-decoration-thickness: 0.1em;
						text-decoration-color: #ff0000;
						text-decoration-style: solid;
					}
					.severity-high {
						color: #ff0000;
					}
					.severity-medium {
						color: #ff6600;
					}
					.severity-low {
						color: #006600;
					}
					table {
						width: 100%;
					}

					.press {
						display: block; /* Remove bullet points; allow greater control of positioning */
						padding: 0; /* Override defaults for lists */
						margin: 0; /* Override defaults for lists */
						width: 100%; /* Get the row full width */
						h1 {
							margin: 0.05em;
						}
						h2 {
							margin: 0.05em;
						}
						h3 {
							margin: 0.025em;
						}
						td {
							padding: 0.05em;
						}
					}

					.press li {
						display: inline-block; /* Get all images to show in a row */
						width: 100%; /* Show 1 logos per row */
						text-align: center; /* Centre align the images */
						border-bottom: 1px solid #ddd;
						padding-bottom: 0.25em;
					}

					.press tr {
						width: 100%;
					}

					@media (max-width: 960px) and (min-width: 501px) {
						.press li {
							width: 50%;
						} /* Show 2 logos per row on medium devices (tablets, phones in landscape) */
					}

					@media (max-width: 500px) {
						.press li {
							width: 100%;
						} /* On small screens, show one logo per row */
					}
				`}</Style>
			</head>
			<body>{props.children}</body>
		</html>
	)
}
