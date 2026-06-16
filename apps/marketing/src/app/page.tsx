import Hero from '@/components/Hero';
import Tecnologias from '@/components/Tecnologias';
import TechFlexConsole from '@/components/TechFlexConsole';
import VantdomusSpotlight from '@/components/VantdomusSpotlight';
import Servicios from '@/components/Servicios';
import Verticales from '@/components/Verticales';
import Nosotros from '@/components/Nosotros';
import Impacto from '@/components/Impacto';
import CalculadoraROI from '@/components/CalculadoraROI';
import ApiSandbox from '@/components/ApiSandbox';
import IdentityBento from '@/components/IdentityBento';
import EdgeMap from '@/components/EdgeMap';
import SdkDocs from '@/components/SdkDocs';
import Tiers from '@/components/Tiers';
import Ecosistema from '@/components/Ecosistema';
import Faq from '@/components/Faq';
import Contacto from '@/components/Contacto';

export default function Home() {
  return (
    <>
      <Hero />
      <Tecnologias />
      <TechFlexConsole />
      <VantdomusSpotlight />
      <Servicios />
      <Verticales />
      <Nosotros />
      <Impacto />
      <ApiSandbox />
      <IdentityBento />
      <EdgeMap />
      <CalculadoraROI />
      <Tiers />
      <SdkDocs />
      <Ecosistema />
      <Faq />
      <Contacto />
    </>
  );
}
