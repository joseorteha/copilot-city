"use client";

import { Building } from "@/components/city/Building";
import { DistrictNetwork } from "@/components/city/District";
import { DependencyRoutes } from "@/components/city/DependencyRoutes";
import { CityWeather } from "@/components/city/CityWeather";
import { CityCitizens } from "@/components/city/CityCitizens";
import { CityInfrastructure } from "@/components/city/CityInfrastructure";
import { Ground } from "@/components/city/Ground";
import { PlazaNetwork } from "@/components/city/Plaza";
import { RoadNetwork } from "@/components/city/Road";
import type { CityModel } from "@/types/city";

export function CityWorld({ city }: { city: CityModel }) {
  const coreBuilding = city.buildings.find((building) => building.id === city.coreBuildingId);
  return (
    <group>
      <Ground city={city} />
      <RoadNetwork roads={city.roads} />
      <DistrictNetwork districts={city.districts} />
      <PlazaNetwork districts={city.districts} coreDistrictId={coreBuilding?.districtId} />
      {city.buildings.map((building, index) => (
        <Building key={building.id} building={building} order={index} />
      ))}
      <DependencyRoutes connections={city.connections} />
      <CityWeather city={city} />
      <CityCitizens city={city} />
      <CityInfrastructure city={city} />
    </group>
  );
}
