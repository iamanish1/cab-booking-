import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import AppScreenshots from "./components/AppScreenshots";
import DriveWithUs from "./components/DriveWithUs";
import Testimonials from "./components/Testimonials";
import Download from "./components/Download";
import Footer from "./components/Footer";
import "./App.css";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <AppScreenshots />
        <DriveWithUs />
        <Testimonials />
        <Download />
      </main>
      <Footer />
    </>
  );
}
