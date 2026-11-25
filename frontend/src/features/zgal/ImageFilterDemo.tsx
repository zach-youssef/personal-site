import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';
import { HeadlessCapture, HeadlessRun, importHeadless, ProgramState, ZgalHeadlessLoader } from './zgalMount';
import { HeadlessSample, programMain, sampleFile } from './samples';

// What the controls ask image_filter for. Each on/off setting is one of its options (--blur <radius>,
// --edges, --threshold <level>), and the ranges are the program's own: e2e checks them against its
// main's option list.
export interface FilterSettings {
	// The picture the visitor chose, or null for the program's default input (assets/input.png)
	file: File | null,
	blur: boolean,
	radius: number,
	edges: boolean,
	threshold: boolean,
	level: number,
}

// The command line ./build-zgal filtered the fallback output with, so the page's first run makes the
// same picture. The threshold's level isn't the program's 0.5, which turns the example's edges (none
// brighter than 0.43) all black: at 0.15, about a tenth of them (9.4% of blur_edges.png's pixels)
// stay white, as lines.
export const DEFAULT_SETTINGS: FilterSettings = {
	file: null, blur: true, radius: 2, edges: true, threshold: false, level: 0.15,
};

export const BLUR_RANGE: [number, number] = [1, 64];
export const LEVEL_RANGE: [number, number] = [0, 1];

// How long after a slider's last change the filter runs again, so dragging one doesn't start a GPU
// run (and a WebGPU device) at every step. Switches and the file picker run it at once.
export const RERUN_DELAY_MS = 300;

// The default input, in assets/ beside the main, where the program's relative paths resolve
const DEFAULT_INPUT = 'input.png';
// The pictures the file picker offers: what ZGAL's web runtime decodes, with stb_image built to
// WebAssembly as natively (web/zgal/image-decode.ts): PNG, JPEG, BMP, GIF, TGA, PSD, Softimage PIC
// and binary PNM (PGM and PPM; stb_image reads no PBM). Named by extension, as browsers know no MIME
// types for most of them; HDR isn't among them, as the runtime's decoder refuses it.
const PICTURE_TYPES = '.png,.jpg,.jpeg,.bmp,.gif,.tga,.psd,.pic,.pnm,.pgm,.ppm';
// The file the program writes, which names the download
export const OUTPUT = 'image_filter.png';

// image_filter's command line for the settings, with the files it reads that the page gives it
export function filterCommandLine(settings: FilterSettings): { args: string[], files: Record<string, Blob> } {
	const files: Record<string, Blob> = {};
	let input = DEFAULT_INPUT;
	if (settings.file) {
		// As ZGAL's own form names a chosen file: a name starting with '-' would read as an option
		input = settings.file.name.startsWith('-') ? `./${settings.file.name}` : settings.file.name;
		files[input] = settings.file;
	}
	const args = [input, OUTPUT];
	if (settings.blur) {
		args.push('--blur', String(settings.radius));
	}
	if (settings.edges) {
		args.push('--edges');
	}
	if (settings.threshold) {
		args.push('--threshold', String(settings.level));
	}
	return { args, files };
}

// 'loading' until the run reports its first state
type FilterState = 'loading' | ProgramState;

interface Props {
	sample: HeadlessSample,
	webGPU: boolean,
	// Changing it runs the filter again with the same settings (choosing the sample again)
	run?: number,
	// Loads the main; tests pass a fake module instead of importing one
	load?: ZgalHeadlessLoader,
}

// An object URL for the blob while it's shown, revoked once it isn't
function useObjectUrl(blob: Blob | null): string | null {
	const [url, setUrl] = useState<string | null>(null);
	useEffect(() => {
		if (!blob) {
			setUrl(null);
			return undefined;
		}
		const created = URL.createObjectURL(blob);
		setUrl(created);
		return () => URL.revokeObjectURL(created);
	}, [blob]);
	return url;
}

// Settles once every run an ImageFilterDemo stopped has finished stopping, which each run waits for,
// so that a run never starts beside another's WebGPU device: shared by every instance, as choosing
// another sample and this one again makes a new one while the last one's run may still be stopping
let pendingStops: Promise<void> = Promise.resolve();

// A picture with its caption, half the column wide; stale while the next one is being made
function Picture({ src, alt, caption, stale = false, children }:
	{ src: string, alt: string, caption: string, stale?: boolean, children?: React.ReactNode }) {
	return (
		<Col xs={6}>
			<figure className={stale ? 'filter-picture stale mb-0' : 'filter-picture mb-0'}>
				<img src={src} alt={alt} />
				<figcaption className="mt-2">{caption}{children}</figcaption>
			</figure>
		</Col>
	);
}

// The pictures ./build-zgal filtered, for a browser without WebGPU or a run that failed
function Fallback({ sample }: { sample: HeadlessSample }) {
	return (
		<Row>
			<Picture src={sampleFile(sample, sample.fallbackInput)} alt={`${sample.title} input`} caption="Input" />
			<Picture src={sampleFile(sample, sample.fallbackOutput)} alt={`${sample.title} output`}
				caption="Output, filtered when the site was built (--blur 2 --edges)" />
		</Row>
	);
}

// A switch for one of the program's options, and its value's slider where it takes one
function OptionControl({ option, label, checked, onToggle, children }: {
	option: string, label: string, checked: boolean, onToggle(checked: boolean): void, children?: React.ReactNode,
}) {
	const id = `image-filter${option}`;
	return (
		<Form.Group className="filter-option" data-option={option}>
			<Form.Check
				type="switch"
				id={id}
				role="switch"
				label={label}
				checked={checked}
				onChange={(event: React.ChangeEvent<HTMLInputElement>) => onToggle(event.target.checked)}
			/>
			{children}
		</Form.Group>
	);
}

// A slider for an option's value, disabled while the option is off
function Slider({ id, label, value, range, step, disabled, format, onChange }: {
	id: string, label: string, value: number, range: [number, number], step: number, disabled: boolean,
	format(value: number): string, onChange(value: number): void,
}) {
	return (
		<div className="filter-slider">
			<Form.Range
				id={id}
				aria-label={label}
				min={range[0]}
				max={range[1]}
				step={step}
				value={value}
				disabled={disabled}
				onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
			/>
			<output htmlFor={id} className={disabled ? 'text-muted' : undefined}>{format(value)}</output>
		</div>
	);
}

// Runs ZGAL's image_filter example on WebGPU (its main's runHeadless) with the site's own controls,
// showing the input beside the PNG it writes, with a link to download it. A changed setting stops the
// last run and starts another, each with its own WebGPU device, the next starting only once the last
// has stopped. Without WebGPU, or when a run of the default input fails, the pictures ./build-zgal
// filtered stand in. The root's data-zgal attribute gives the state, for tests.
function ImageFilterDemo({ sample, webGPU, run = 0, load = importHeadless }: Props) {
	// What the controls show, and what the filter last ran (or is about to run) with: a slider's
	// changes reach it RERUN_DELAY_MS after the last one
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [applied, setApplied] = useState(DEFAULT_SETTINGS);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [state, setState] = useState<FilterState>('loading');
	const [capture, setCapture] = useState<Blob | null>(null);
	// Why the last run failed: its messages, or why its main didn't load (may be empty)
	const [failure, setFailure] = useState<string | null>(null);
	// Bumped to clear the file input when going back to the example, so that choosing the same
	// picture again is a change
	const [pickerKey, setPickerKey] = useState(0);
	const chosenUrl = useObjectUrl(settings.file);
	const outputUrl = useObjectUrl(capture);
	const mainUrl = programMain(sample);

	const change = (next: Partial<FilterSettings>, delay = 0) => {
		const updated = { ...settings, ...next };
		setSettings(updated);
		clearTimeout(timer.current);
		if (delay > 0) {
			timer.current = setTimeout(() => setApplied(updated), delay);
		} else {
			setApplied(updated);
		}
	};
	useEffect(() => () => clearTimeout(timer.current), []);

	useEffect(() => {
		if (!webGPU) {
			return undefined;
		}
		// Set by the cleanup: this run stops, and nothing of it reaches the page
		let current = true;
		let program: HeadlessRun | null = null;
		const messages: string[] = [];
		const { args, files } = filterCommandLine(applied);
		setState('loading');
		setFailure(null);
		const fail = (text: string) => {
			if (current) {
				// The alert says it too; a warning, as a browser that can't run it isn't the page's error
				console.warn(`${sample.title} failed${text ? `: ${text}` : ''}`);
				setFailure(text);
				setCapture(null);
				setState('failed');
			}
		};

		const previous = pendingStops;
		// Settles once runHeadless has returned, or the run didn't get that far
		const launched = (async () => {
			await previous;
			if (!current) {
				return;
			}
			const module = await load(mainUrl);
			if (!current) {
				return;
			}
			if (typeof module?.runHeadless !== 'function') {
				throw new Error(`${mainUrl} doesn't export runHeadless`);
			}
			program = module.runHeadless({
				args,
				files,
				onCapture: (made: HeadlessCapture) => current && setCapture(made.png),
				onState: next => current && next !== 'failed' && setState(next),
				onMessage: text => messages.push(text),
			});
		})().catch(error => {
			fail(`${mainUrl}: ${error instanceof Error ? error.message : String(error)}`);
		});
		launched.then(() => program?.done).then(end => {
			if (end === 'failed') {
				fail(messages.join('\n'));
			}
		});

		return () => {
			current = false;
			// A failing stop mustn't keep the next run from starting
			const stopped = launched.then(() => program?.stop()).catch(error => console.error(error));
			pendingStops = Promise.all([pendingStops, stopped]).then(() => undefined);
		};
	}, [webGPU, applied, run, mainUrl, load, sample.title]);

	if (!webGPU) {
		return <div data-zgal="unsupported"><Fallback sample={sample} /></div>;
	}

	const busy = state === 'loading' || state === 'running';
	const defaultInputUrl = sampleFile(sample, `assets/${DEFAULT_INPUT}`);
	return (
		<div className="image-filter" data-zgal={state}>
			<Form onSubmit={event => event.preventDefault()}>
				<Form.Group className="form-field">
					<Form.Label htmlFor="image-filter-picture">Picture</Form.Label>
					<input
						key={pickerKey}
						type="file"
						className="file-picker"
						id="image-filter-picture"
						accept={PICTURE_TYPES}
						onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
							const file = event.target.files?.[0];
							if (file) {
								change({ file });
							}
						}}
					/>
					{settings.file && (
						<Button variant="secondary" size="sm" className="mt-2" onClick={() => {
							setPickerKey(key => key + 1);
							change({ file: null });
						}}>
							Use the example picture
						</Button>
					)}
				</Form.Group>
				<OptionControl option="--blur" label="Blur" checked={settings.blur} onToggle={blur => change({ blur })}>
					<Slider id="image-filter-radius" label="Blur radius" value={settings.radius} range={BLUR_RANGE}
						step={1} disabled={!settings.blur} format={radius => `${radius} px`}
						onChange={radius => change({ radius }, RERUN_DELAY_MS)} />
				</OptionControl>
				<OptionControl option="--edges" label="Edges" checked={settings.edges} onToggle={edges => change({ edges })} />
				<OptionControl option="--threshold" label="Threshold" checked={settings.threshold}
					onToggle={threshold => change({ threshold })}>
					<Slider id="image-filter-level" label="Threshold level" value={settings.level} range={LEVEL_RANGE}
						step={0.01} disabled={!settings.threshold} format={level => level.toFixed(2)}
						onChange={level => change({ level }, RERUN_DELAY_MS)} />
				</OptionControl>
			</Form>
			{failure !== null && (applied.file
				? <Alert variant="danger">{sample.title} couldn't filter {applied.file.name}: {failure || 'it failed.'}</Alert>
				: (
					<Alert variant="danger">
						{sample.title} couldn't run in this browser.
						{failure && <div className="filter-failure small mt-1">{failure}</div>}
					</Alert>
				))}
			{failure !== null && !applied.file
				? <Fallback sample={sample} />
				: (
					<Row>
						<Picture src={chosenUrl ?? defaultInputUrl} alt={`${sample.title} input`} caption="Input" />
						{outputUrl
							? (
								// The last output, faded and without its link while the next is being made
								<Picture src={outputUrl} alt={`${sample.title} output`} caption="Output" stale={busy}>
									{!busy && <>{' · '}<a href={outputUrl} download={OUTPUT}>Download</a></>}
								</Picture>
							)
							: <Col xs={6} />}
					</Row>
				)}
			<p className="text-muted mt-2 mb-0" role="status">{busy ? 'Filtering…' : ' '}</p>
		</div>
	);
}

export default ImageFilterDemo;
