/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "./audio-pulse.scss";
import React from "react";
import { useEffect, useRef } from "react";
import c from "classnames";

const lineCount = 3;

export type AudioPulseProps = {
	active: boolean;
	volume: number;
	hover?: boolean;
};

export default function AudioPulse({ active, volume, hover }: AudioPulseProps) {
	const lines = useRef<HTMLDivElement[]>([]);

	useEffect(() => {
		let timeout: number | null = null;
		const update = () => {
			lines.current.forEach(
				(line, i) =>
				(line.style.height = `${Math.min(
					24,
					4 + volume * (i === 1 ? 400 : 60),
				)}px`),
			);
			timeout = window.setTimeout(update, 100);
		};

		update();

		return () => clearTimeout((timeout as number)!);
	}, [volume]);

	return (
		<div className={c(
			"flex items-center justify-center gap-1 p-2",
			active ? "opacity-100" : "opacity-50",
			hover && "hover:opacity-75 transition-opacity duration-200"
		)}>
			{Array(lineCount)
				.fill(null)
				.map((_, i) => (
					<div
						key={i}
						ref={(el) => {
							if (el) lines.current[i] = el;
						}}
						className={c(
							"w-1 bg-primary rounded-full transition-all duration-200",
							active && "animate-pulse"
						)}
						style={{ 
							animationDelay: `${i * 133}ms`,
							minHeight: "4px"
						}}
					/>
				))}
		</div>
	);
}
