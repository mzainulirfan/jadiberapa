import { kelontong } from "./kelontong"
import { kios } from "./kios"
import { toserba } from "./toserba"
import { warungMakan } from "./warung-makan"
import type { StoreTemplate } from "./types"

export { EMPTY_TEMPLATE_KEY, storeTemplateOptions } from "./options"
export type { StoreTemplate, TemplateDiscount, TemplateProduct } from "./types"

export const storeTemplates: StoreTemplate[] = [kelontong, warungMakan, kios, toserba]

export function getStoreTemplate(key: string): StoreTemplate | undefined {
  return storeTemplates.find((template) => template.key === key)
}
