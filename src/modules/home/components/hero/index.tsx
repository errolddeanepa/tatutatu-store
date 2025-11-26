import { Button, Heading } from "@medusajs/ui"
import Image from "next/image"
import Link from "next/link"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative overflow-hidden">
      {/* Background image layer - replace /hero-bg.jpg with your image */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <Image
          src="https://cdn.hubblecontent.osi.office.net/m365content/publish/79a2bc60-ba05-437d-9c0d-3287f3c3219b/thumbnails/xxlarge.jpg"
          alt="Shop banner background"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Optional dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Content layer */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-bottom text-center small:p-32 gap-6">
        {/*<span>
           <Heading
            level="h1"
            className="text-4xl small:text-5xl leading-tight text-white font-semibold drop-shadow"
          >
            Ecommerce Starter Template
          </Heading>
          <Heading
            level="h2"
            className="text-xl small:text-2xl leading-9 text-white/90 font-normal drop-shadow"
          >
            Powered by Medusa and Next.js
          </Heading> 
        </span>*/}
        <Link href="/store">
          <Button size="large" variant="primary" className="text-xl small:text-2xl leading-9 text-white/90 font-normal drop-shadow">
            Shop Now
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default Hero