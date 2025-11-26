import { Text } from "@medusajs/ui"
import { FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa"

import Medusa from "../../../common/icons/medusa"
import NextJs from "../../../common/icons/nextjs"

const MedusaCTA = () => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center">
      Follow Us
      <a href="tatutatushop.com" target="_blank" rel="noreferrer">
        <FaFacebook className="icon-[mdi-light--home] h-8 w-8" />
      </a>
      <a href="tatutatushop.com" target="_blank" rel="noreferrer">
        <FaInstagram className="icon-[mdi-light--home] h-8 w-8" />
      </a>
      <a href="tatutatushop.com" target="_blank" rel="noreferrer">
        <FaTiktok className="icon-[mdi-light--home] h-8 w-8" />
      </a>
    </Text>
  )
}

export default MedusaCTA