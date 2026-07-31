"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

type BarcodeFormat = "CODE128" | "EAN13" | "auto"

type Props = {
  value: string
  format?: BarcodeFormat
  height?: number
  displayValue?: boolean
  fontSize?: number
  className?: string
}

function draw(
  svg: SVGSVGElement,
  value: string,
  format: BarcodeFormat,
  height: number,
  displayValue: boolean,
  fontSize: number
) {
  const opts = { height, displayValue, margin: 0, width: 2, fontSize }
  if (format === "auto") {
    if (/^\d{13}$/.test(value)) {
      try {
        JsBarcode(svg, value, { ...opts, format: "EAN13" })
        return
      } catch {
        // fall through to Code128
      }
    }
    JsBarcode(svg, value, { ...opts, format: "CODE128" })
    return
  }
  JsBarcode(svg, value, { ...opts, format })
}

export function Barcode({
  value,
  format = "CODE128",
  height = 48,
  displayValue = true,
  fontSize = 12,
  className,
}: Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      draw(ref.current, value, format, height, displayValue, fontSize)
    } catch {
      // nilai tidak valid untuk format — biarkan kosong
    }
  }, [value, format, height, displayValue, fontSize])
  return <svg ref={ref} className={className} />
}

/** Serialize a barcode ke string SVG untuk disisipkan pada HTML cetak. */
export function barcodeSvgString(
  value: string,
  format: "CODE128" | "EAN13" = "CODE128",
  opts?: { height?: number; fontSize?: number; displayValue?: boolean }
): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  const base = {
    height: opts?.height ?? 48,
    fontSize: opts?.fontSize ?? 12,
    displayValue: opts?.displayValue ?? true,
    margin: 0,
    width: 2,
  }
  try {
    JsBarcode(svg, value, { ...base, format })
  } catch {
    try {
      JsBarcode(svg, value, { ...base, format: "CODE128" })
    } catch {
      // nilai tidak valid — kembalikan svg kosong
    }
  }
  return new XMLSerializer().serializeToString(svg)
}
