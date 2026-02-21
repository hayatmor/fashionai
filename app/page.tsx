import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import StudioSection from "@/components/StudioSection";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <StudioSection />
      </main>
    </>
  );
}
