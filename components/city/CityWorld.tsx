"use client";

import { Building } from "@/components/city/Building";
import { District } from "@/components/city/District";
import { DependencyRoutes } from "@/components/city/DependencyRoutes";
import { CityWeather } from "@/components/city/CityWeather";
import { CityCitizens } from "@/components/city/CityCitizens";
import { CityInfrastructure } from "@/components/city/CityInfrastructure";
import { Ground } from "@/components/city/Ground";
import { Plaza } from "@/components/city/Plaza";
import { Road } from "@/components/city/Road";
import type { CityModel } from "@/types/city";

export function CityWorld({ city }: { city: CityModel }) {
  const coreBuilding = city.buildings.find((building) => building.id === city.coreBuildingId);
  return (
    <group>
      <Ground bounds={city.bounds} />
      {city.roads.map((road, index) => (
        <Road key={road.id} road={road} order={index} />
      ))}
      {city.districts.map((district, index) => (
        <District key={district.id} district={district} order={index} />
      ))}
      {city.districts.map((district) => <Plaza key={`plaza:${district.id}`} district={district} isCore={coreBuilding?.districtId === district.id} />)}
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
